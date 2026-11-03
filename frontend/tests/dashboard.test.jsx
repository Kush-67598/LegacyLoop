import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardView from "@/components/dashboard/DashboardView";
import { listCases } from "@/services/caseService";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/services/caseService", () => ({ listCases: vi.fn() }));

describe("DashboardView", () => {
  beforeEach(() => listCases.mockReset());

  it("derives case metrics from the API response and shows the empty state", async () => {
    listCases.mockResolvedValue([]);
    render(<DashboardView />);
    expect(await screen.findByText("No handover cases yet")).toBeInTheDocument();
    expect(listCases).toHaveBeenCalledOnce();
  });

  it("shows API errors and retries the case request", async () => {
    listCases.mockRejectedValueOnce(new Error("API is unavailable")).mockResolvedValueOnce([]);
    render(<DashboardView />);
    expect(await screen.findByText("API is unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("No handover cases yet")).toBeInTheDocument());
    expect(listCases).toHaveBeenCalledTimes(2);
  });
});
