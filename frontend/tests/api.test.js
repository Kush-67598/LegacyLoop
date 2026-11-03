import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/services/api";

afterEach(() => vi.unstubAllGlobals());

describe("apiRequest", () => {
  it.each(["GET", "POST", "PATCH", "DELETE"])("sends the default demo reviewer identity on %s requests", async (method) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/cases", { method });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.get("x-demo-user")).toBe("demo-reviewer");
    expect(headers.get("x-demo-role")).toBe("reviewer");
  });

  it("unwraps the standard success envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: "case-1" } }), { status: 200 })));
    await expect(apiRequest("/cases")).resolves.toEqual({ id: "case-1" });
  });

  it("retries a temporary GET connection failure and then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { cases: [] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/cases")).resolves.toEqual({ cases: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops after at most two retries for a GET connection failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/cases")).rejects.toMatchObject({ message: expect.stringContaining("Unable to connect") });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not replay a case-creation POST after a connection failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/cases", { method: "POST", body: JSON.stringify({ title: "Test" }) })).rejects.toMatchObject({ message: expect.stringContaining("Unable to connect") });
    expect(fetchMock).toHaveBeenCalledOnce();
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
