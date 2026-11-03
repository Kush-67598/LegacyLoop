import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClaimsWorkspace from "@/components/claims/ClaimsWorkspace";
import ReviewQueue from "@/components/review/ReviewQueue";
import HandoverWorkspace from "@/components/handover/HandoverWorkspace";
import { getClaimConflicts, listClaims } from "@/services/claimService";
import { listEvidence } from "@/services/evidenceService";
import { listReviews, reviewClaim } from "@/services/reviewService";
import { generateHandover } from "@/services/handoverService";

const mockSearchParams = vi.hoisted(() => ({ get: () => null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => mockSearchParams }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/services/claimService", () => ({ getClaimConflicts: vi.fn(), listClaims: vi.fn() }));
vi.mock("@/services/evidenceService", () => ({ listEvidence: vi.fn() }));
vi.mock("@/services/reviewService", () => ({ listReviews: vi.fn(), reviewClaim: vi.fn() }));
vi.mock("@/services/handoverService", () => ({ generateHandover: vi.fn() }));

const claim = {
  _id: "claim-1", caseId: "case-1", text: "Retry attempts are limited to three.", claimType: "technical_decision",
  evidenceIds: ["evidence-1"], citations: [{ evidenceId: "evidence-1", quote: "Retries are capped at three." }],
  status: "verified", reviewStatus: "pending", accessLevel: "team", version: 1,
  verification: { citationCheck: { valid: true, failures: [] }, supportCheck: { reason: "AI support verification has not been configured." } }
};
const evidence = [{ _id: "evidence-1", sourceName: "decisions.md", sourceType: "markdown_document", locator: "document:decisions.md", text: "Retries are capped at three.", accessLevel: "team" }];

beforeEach(() => {
  listClaims.mockResolvedValue([claim]);
  listEvidence.mockResolvedValue(evidence);
  listReviews.mockResolvedValue([]);
  getClaimConflicts.mockResolvedValue([]);
  reviewClaim.mockReset();
  generateHandover.mockReset();
});

describe("claim review and handover screens", () => {
  it("keeps verification and human review statuses separate in the claims list", async () => {
    render(<ClaimsWorkspace caseId="case-1" />);
    expect(await screen.findByText(claim.text)).toBeInTheDocument();
    expect(screen.getAllByText("verified").length).toBeGreaterThan(0);
    expect(screen.getAllByText("pending").length).toBeGreaterThan(0);
  });

  it("sends approval through the backend review action", async () => {
    reviewClaim.mockResolvedValue({ claim: { ...claim, reviewStatus: "approved" }, review: { action: "approved" } });
    render(<ReviewQueue caseId="case-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Retry attempts are limited to three/i }));
    fireEvent.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => expect(reviewClaim).toHaveBeenCalledWith("claim-1", { action: "approve", comment: "" }));
  });

  it("renders only the handover sections and citations returned by the API", async () => {
    generateHandover.mockResolvedValue({
      _id: "handover-1", status: "published", version: 1, role: "reviewer", createdAt: "2026-11-03T10:00:00.000Z",
      sections: [
        { key: "project_overview", title: "Project Overview", context: { projectName: "Payments" }, items: [], missingInformation: [] },
        { key: "technical_decisions", title: "Technical Decisions", items: [{ id: "claim-1", text: claim.text, claimType: claim.claimType, version: 1, citations: [{ evidenceId: "evidence-1", quote: "Retries are capped at three.", sourceType: "markdown_document", sourceName: "decisions.md", locator: "document:decisions.md" }] }], missingInformation: [] }
      ]
    });
    render(<HandoverWorkspace caseId="case-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Generate handover/i }));
    expect(await screen.findByText(claim.text)).toBeInTheDocument();
    expect(screen.getByText(/decisions\.md · document:decisions\.md/)).toBeInTheDocument();
    expect(generateHandover).toHaveBeenCalledWith("case-1");
  });
});
