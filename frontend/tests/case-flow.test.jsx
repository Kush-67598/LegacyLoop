import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewCaseFlow from "@/components/cases/NewCaseFlow";
import { createCase } from "@/services/caseService";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/services/caseService", () => ({ createCase: vi.fn() }));

describe("NewCaseFlow", () => {
  beforeEach(() => { push.mockReset(); createCase.mockReset(); });

  it("validates each step, creates the case and redirects with the API id", async () => {
    createCase.mockResolvedValue({ _id: "case-123" });
    render(<NewCaseFlow />);

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect((await screen.findAllByText("This field is required.")).length).toBe(2);

    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: "Payments" } });
    fireEvent.change(screen.getByLabelText(/case title/i), { target: { value: "Payments handover" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    fireEvent.change(screen.getByLabelText(/departing member/i), { target: { value: "Morgan" } });
    fireEvent.change(screen.getByLabelText(/successor/i), { target: { value: "Taylor" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /create case/i }));

    await waitFor(() => expect(createCase).toHaveBeenCalledWith({ projectName: "Payments", title: "Payments handover", description: "", departingMember: "Morgan", successor: "Taylor" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/cases/case-123"));
  });

  it("shows backend validation errors without redirecting", async () => {
    createCase.mockRejectedValue(new Error("Case title already exists"));
    render(<NewCaseFlow />);
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: "Payments" } });
    fireEvent.change(screen.getByLabelText(/case title/i), { target: { value: "Payments handover" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.change(screen.getByLabelText(/departing member/i), { target: { value: "Morgan" } });
    fireEvent.change(screen.getByLabelText(/successor/i), { target: { value: "Taylor" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /create case/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Case title already exists");
    expect(push).not.toHaveBeenCalled();
  });
});
