import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EvidenceWorkspace from "@/components/evidence/EvidenceWorkspace";
import { listClaims } from "@/services/claimService";
import { listEvidence, uploadEvidence } from "@/services/evidenceService";

const mockSearchParams = vi.hoisted(() => ({ get: () => null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => mockSearchParams }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/services/claimService", () => ({ listClaims: vi.fn() }));
vi.mock("@/services/evidenceService", () => ({ getEvidence: vi.fn(), listEvidence: vi.fn(), uploadEvidence: vi.fn() }));

describe("EvidenceWorkspace uploads", () => {
  beforeEach(() => {
    listEvidence.mockResolvedValue([]);
    listClaims.mockResolvedValue([]);
    uploadEvidence.mockReset();
  });

  it("shows the real partial-processing report returned by the backend", async () => {
    uploadEvidence.mockResolvedValue({ totalFilesUploaded: 1, recordsExtracted: 3, recordsSaved: 2, duplicateRecordsSkipped: 0, failedFiles: [{ filename: "export.json", reason: "Record 3 is invalid" }], unsupportedFiles: [] });
    const { container } = render(<EvidenceWorkspace caseId="case-1" />);
    const input = container.querySelector('input[type="file"]');
    const file = new File(["[]"], "export.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: "Upload 1" }));

    expect(await screen.findByText("Upload completed with file issues")).toBeInTheDocument();
    expect(screen.getByText(/Record 3 is invalid/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(uploadEvidence).toHaveBeenCalledWith("case-1", [file]);
  });

  it("rejects unsupported extensions before submitting", async () => {
    const { container } = render(<EvidenceWorkspace caseId="case-1" />);
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(["x"], "script.exe", { type: "application/octet-stream" })] } });
    expect(await screen.findByText(/unsupported extension/i)).toBeInTheDocument();
    expect(uploadEvidence).not.toHaveBeenCalled();
  });

  it("reports backend upload failures and leaves the chosen file visible", async () => {
    uploadEvidence.mockRejectedValue(new Error("Upload exceeds the server limit"));
    const { container } = render(<EvidenceWorkspace caseId="case-1" />);
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(["[]"], "export.json", { type: "application/json" })] } });
    fireEvent.click(await screen.findByRole("button", { name: "Upload 1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload exceeds the server limit");
    await waitFor(() => expect(screen.getByText("export.json")).toBeInTheDocument());
  });
});
