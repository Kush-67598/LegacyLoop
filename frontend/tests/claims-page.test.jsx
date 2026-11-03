import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClaimsWorkspace from "@/components/claims/ClaimsWorkspace";
import { getClaimConflicts, listClaims } from "@/services/claimService";
import { listEvidence } from "@/services/evidenceService";
import { listReviews } from "@/services/reviewService";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/services/claimService", () => ({ getClaimConflicts: vi.fn(), listClaims: vi.fn(), createClaim: vi.fn(), getClaim: vi.fn() }));
vi.mock("@/services/evidenceService", () => ({ listEvidence: vi.fn() }));
vi.mock("@/services/reviewService", () => ({ listReviews: vi.fn() }));

const claimData = [
  { _id: "claim-config", caseId: "case-1", text: "Production retries use three attempts.", claimType: "configuration", status: "pending", reviewStatus: "pending", accessLevel: "team", version: 1, evidenceIds: ["evidence-1"], citations: [{ evidenceId: "evidence-1", quote: "Production retry limit is three." }] },
  { _id: "claim-risk", caseId: "case-1", text: "Refund idempotency remains unfinished.", claimType: "unfinished_work", status: "conflicting", reviewStatus: "needs_more_evidence", accessLevel: "leads_only", version: 1, evidenceIds: ["evidence-2"], citations: [{ evidenceId: "evidence-2", quote: "Idempotency is not implemented yet." }] }
];

beforeEach(() => {
  vi.clearAllMocks();
  listClaims.mockResolvedValue(claimData);
  listEvidence.mockResolvedValue([
    { _id: "evidence-1", sourceName: "payments-config.md", locator: "config:production", text: "Production retry limit is three.", author: "Alex", timestamp: "2026-10-20T10:30:00.000Z", metadata: { environment: "production", configVersion: "v3" }, accessLevel: "team" },
    { _id: "evidence-2", sourceName: "refund-pr.json", locator: "pull_request:208", text: "Idempotency is not implemented yet.", author: "Sam", accessLevel: "leads_only" }
  ]);
  listReviews.mockResolvedValue([]);
  getClaimConflicts.mockResolvedValue([]);
});

describe("claims page", () => {
  it("filters claims by category, verification, and review status and shows exact citations", async () => {
    render(<ClaimsWorkspace caseId="case-1" />);
    expect(await screen.findByText("Production retries use three attempts.")).toBeInTheDocument();
    expect(screen.getByText("Refund idempotency remains unfinished.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Category filter" }), { target: { value: "configuration" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Verification filter" }), { target: { value: "pending" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Review filter" }), { target: { value: "pending" } });

    expect(screen.getByText("Production retries use three attempts.")).toBeInTheDocument();
    expect(screen.queryByText("Refund idempotency remains unfinished.")).not.toBeInTheDocument();
    expect(screen.getByText(/Production retry limit is three\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Production retries use three attempts/i }));
    await waitFor(() => expect(getClaimConflicts).toHaveBeenCalledWith("claim-config"));
    expect(screen.getByText("Supporting evidence (1)")).toBeInTheDocument();
    expect(screen.getByText(/payments-config.md · config:production/)).toBeInTheDocument();
    expect(screen.getByText(/Alex .* access team · production · version v3/)).toBeInTheDocument();
  });
});
