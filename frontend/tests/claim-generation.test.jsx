import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CaseWorkspace from "@/components/cases/CaseWorkspace";
import { getCase, getCaseProgress, listCaseClaims, listCaseEvidence, updateCase } from "@/services/caseService";
import { analyzeCase } from "@/services/analysisService";
import { generateClaims } from "@/services/claimService";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/services/caseService", () => ({ getCase: vi.fn(), getCaseProgress: vi.fn(), listCaseClaims: vi.fn(), listCaseEvidence: vi.fn(), updateCase: vi.fn() }));
vi.mock("@/services/analysisService", () => ({ analyzeCase: vi.fn() }));
vi.mock("@/services/claimService", () => ({ generateClaims: vi.fn() }));

const caseRecord = { _id: "case-1", projectName: "Payments", title: "Payment handover", departingMember: "Alex", successor: "Sam", status: "created", createdAt: "2026-10-20", updatedAt: "2026-10-20" };
const evidenceRecord = { _id: "evidence-1", text: "Production webhook retries are three." };
const analysisResult = { ownership: [], contributors: [], openWork: { openTasks: [], unmergedPullRequests: [] }, timeline: [] };

beforeEach(() => {
  vi.clearAllMocks();
  getCase.mockResolvedValue(caseRecord);
  getCaseProgress.mockResolvedValue({ counts: { evidence: 1, claims: 0, verified: 0, humanApprovedUnverified: 0, pendingReviews: 0 }, verification: { aiUnavailable: false }, stages: { caseCreated: true, evidenceCollected: true, claimsExtracted: false, claimsVerified: false, humanReview: false, handoverReady: false } });
  listCaseClaims.mockResolvedValue([]);
  listCaseEvidence.mockResolvedValue([evidenceRecord]);
  updateCase.mockResolvedValue(caseRecord);
  analyzeCase.mockResolvedValue(analysisResult);
});

describe("case overview claim generation", () => {
  it("uses database-backed progress while keeping verification separate from terminal human review", async () => {
    listCaseEvidence.mockResolvedValue(Array.from({ length: 17 }, (_, index) => ({ _id: `evidence-${index}` })));
    listCaseClaims.mockResolvedValue([
      { _id: "approved-claim", status: "needs_ai_review", reviewStatus: "approved" },
      { _id: "rejected-claim", status: "needs_ai_review", reviewStatus: "rejected" }
    ]);
    getCaseProgress.mockResolvedValue({
      counts: { evidence: 17, claims: 21, verified: 0, humanApprovedUnverified: 17, pendingReviews: 0 },
      verification: { aiUnavailable: true },
      stages: { caseCreated: true, evidenceCollected: true, claimsExtracted: true, claimsVerified: false, humanReview: true, handoverReady: true }
    });
    render(<CaseWorkspace caseId="case-1" />);

    expect(await screen.findByText("Human review")).toBeInTheDocument();
    expect(getCaseProgress).toHaveBeenCalledWith("case-1", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText("AI verified").parentElement.parentElement).toHaveTextContent("0");
    expect(screen.getByText("Approved, not AI-verified").parentElement.parentElement).toHaveTextContent("17");
    expect(screen.getByText("Pending reviews").parentElement.parentElement).toHaveTextContent("0");
    expect(screen.getByText("Human review").parentElement.parentElement.parentElement.className).toContain("border-violet-300");
    expect(screen.getByText("Claims verified").parentElement.parentElement.parentElement.className).not.toContain("border-violet-300");
    expect(screen.getByText("AI Verification Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Handover ready").parentElement.parentElement.parentElement.className).toContain("border-emerald-300");
  });

  it("waits for analysis, confirms once, prevents duplicate submissions, and links generated claims", async () => {
    let resolveGeneration;
    generateClaims.mockReturnValue(new Promise((resolve) => { resolveGeneration = resolve; }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CaseWorkspace caseId="case-1" />);

    const generateButton = await screen.findByRole("button", { name: /generate claims/i });
    expect(generateButton).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /run analysis/i }));
    await screen.findByText("Contributor signals");
    expect(generateButton).toBeEnabled();

    fireEvent.click(generateButton);
    fireEvent.click(generateButton);
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(generateClaims).toHaveBeenCalledOnce();
    expect(generateButton).toBeDisabled();

    await act(async () => resolveGeneration({ generatedCount: 1, skippedCount: 0, claims: [{ _id: "claim-1", text: "Production retry count is three.", claimType: "configuration", status: "pending", reviewStatus: "pending", evidenceIds: [evidenceRecord._id], citations: [] }] }));
    expect(await screen.findByText(/Generated 1 new claim/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open claims/i })).toHaveAttribute("href", "/cases/case-1/claims");
  });

  it("honors cancellation without calling the generation endpoint", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CaseWorkspace caseId="case-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /run analysis/i }));
    const generateButton = await screen.findByRole("button", { name: /generate claims/i });
    fireEvent.click(generateButton);
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(generateClaims).not.toHaveBeenCalled();
  });
});
