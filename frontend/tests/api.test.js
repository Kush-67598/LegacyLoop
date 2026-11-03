import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/services/api";

afterEach(() => vi.unstubAllGlobals());

describe("apiRequest", () => {
  it("unwraps the standard success envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: "case-1" } }), { status: 200 })));
    await expect(apiRequest("/cases")).resolves.toEqual({ id: "case-1" });
  });

  it("keeps the upload report from a partial 207 response", async () => {
    const report = { recordsSaved: 2, failedFiles: [{ filename: "bad.json", reason: "Invalid JSON" }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, message: "Partial upload", data: report }), { status: 207 })));
    await expect(apiRequest("/cases/case-1/upload", { method: "POST", body: new FormData() })).resolves.toEqual(report);
  });

  it("returns API error messages and status codes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, message: "Reviewer access required", error: { code: "ROLE_FORBIDDEN" } }), { status: 403 })));
    await expect(apiRequest("/claims/claim-1/review")).rejects.toMatchObject({ message: "Reviewer access required", status: 403, code: "ROLE_FORBIDDEN" });
  });
});
