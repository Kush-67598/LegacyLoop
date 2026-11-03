import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDirectory = path.resolve(frontendDirectory, "../backend");
const backendEntry = path.join(backendDirectory, "src/server.js");
const startupTimeoutMs = 60_000;
const healthPollIntervalMs = 400;

async function loadApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  try {
    const localEnv = await readFile(path.join(frontendDirectory, ".env.local"), "utf8");
    const line = localEnv.match(/^\s*NEXT_PUBLIC_API_URL\s*=\s*(.*?)\s*$/m)?.[1];
    if (line) return line.replace(/^['"]|['"]$/g, "").replace(/\/$/, "");
  } catch {
    // A local env file is optional; the API client uses this same default.
  }
  return "http://localhost:4000/api";
}

async function isBackendReady(healthUrl) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1500), cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

function spawnProcess(command, args, cwd, env = process.env) {
  return spawn(command, args, { cwd, stdio: "inherit", env });
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once("error", (error) => resolve({ error }));
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function main() {
  const apiBaseUrl = await loadApiBaseUrl();
  const healthUrl = `${apiBaseUrl}/health`;
  let backendProcess;
  let nextProcess;
  let stopping = false;

  const stopChildren = () => {
    stopping = true;
    nextProcess?.kill("SIGTERM");
    backendProcess?.kill("SIGTERM");
  };
  process.once("SIGINT", stopChildren);
  process.once("SIGTERM", stopChildren);

  try {
    if (!(await isBackendReady(healthUrl))) {
      const apiUrl = new URL(apiBaseUrl);
      if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(apiUrl.hostname)) {
        throw new Error(`Backend is not ready at ${healthUrl}. Start the configured API before the frontend.`);
      }

      console.log("LegacyLoop API is not ready; starting the backend and waiting for MongoDB health…");
      const backendEnv = { ...process.env, PORT: apiUrl.port || "4000" };
      backendProcess = spawnProcess(process.execPath, ["--watch", backendEntry], backendDirectory, backendEnv);
      let backendResult;
      const backendExit = waitForExit(backendProcess).then((result) => {
        backendResult = result;
        return result;
      });
      const deadline = Date.now() + startupTimeoutMs;

      while (Date.now() < deadline && !stopping) {
        if (backendResult) {
          const result = await backendExit;
          if (result.error) throw result.error;
          throw new Error(`Backend exited before becoming ready (${result.code ?? result.signal}). Check MongoDB and backend logs.`);
        }
        if (await isBackendReady(healthUrl)) break;
        await new Promise((resolve) => setTimeout(resolve, healthPollIntervalMs));
      }

      if (stopping) return;
      if (!(await isBackendReady(healthUrl))) {
        throw new Error(`Backend did not become healthy within ${startupTimeoutMs / 1000} seconds at ${healthUrl}.`);
      }
      console.log("LegacyLoop API is healthy; starting Next.js.");
    } else {
      console.log("LegacyLoop API is already healthy; starting Next.js.");
    }

    nextProcess = spawnProcess(process.execPath, ["node_modules/next/dist/bin/next", "dev"], frontendDirectory);
    const result = await waitForExit(nextProcess);
    if (result.error) throw result.error;
    if (!stopping && backendProcess) backendProcess.kill("SIGTERM");
    process.exitCode = result.code ?? 1;
  } finally {
    if (backendProcess && backendProcess.exitCode === null) {
      backendProcess.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(`Unable to start LegacyLoop development stack: ${error.message}`);
  process.exitCode = 1;
});
