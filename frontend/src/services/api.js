const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
const MAX_CONNECTION_RETRIES = 2;
const RETRY_DELAYS_MS = [250, 500];

function canRetry(method) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // These identity headers exist only for the backend's local development stub.
  // Defaults keep a fresh local checkout usable even before .env.local is created.
  if (process.env.NODE_ENV !== "production") {
    const demoUser = process.env.NEXT_PUBLIC_DEMO_USER?.trim() || "demo-reviewer";
    const demoRole = process.env.NEXT_PUBLIC_DEMO_ROLE?.trim() || "reviewer";
    headers.set("x-demo-user", demoUser);
    headers.set("x-demo-role", demoRole);
  }

  const method = options.method || "GET";
  const retryable = canRetry(method);
  let response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      response = await fetch(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
        ...options,
        headers,
        cache: "no-store"
      });
      break;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (!retryable || attempt >= MAX_CONNECTION_RETRIES) {
        throw new ApiError(`Unable to connect to the LegacyLoop API at ${API_BASE_URL}.`);
      }
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("The API returned an unreadable response.", { status: response.status });
  }

  // The upload API returns 207 with a useful partial-processing report.
  if (!response.ok || (payload?.success === false && response.status !== 207)) {
    throw new ApiError(payload?.message || "The request could not be completed.", {
      status: response.status,
      code: payload?.error?.code
    });
  }
  return payload?.data;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}
