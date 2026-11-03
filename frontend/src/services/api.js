const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/$/, "");

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
  if (process.env.NODE_ENV !== "production") {
    const demoUser = process.env.NEXT_PUBLIC_DEMO_USER;
    if (demoUser) headers.set("x-demo-user", demoUser);
    const demoRole = process.env.NEXT_PUBLIC_DEMO_ROLE;
    if (demoRole) headers.set("x-demo-role", demoRole);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      ...options,
      headers,
      cache: "no-store"
    });
  } catch {
    throw new ApiError(`Unable to connect to the LegacyLoop API at ${API_BASE_URL}.`);
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
