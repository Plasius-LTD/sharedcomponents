import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusPanel } from "../src/index.js";

describe("StatusPanel", () => {
  it("renders status content with polite announcements", () => {
    render(
      <StatusPanel
        title="Loading profile settings"
        description="Fetching the latest profile state."
        meta="Trace ID: route-123"
        announce="polite"
      />,
    );

    const panel = screen.getByRole("status", { name: /loading profile settings/i });
    expect(panel.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("Fetching the latest profile state.")).toBeTruthy();
    expect(screen.getByText("Trace ID: route-123")).toBeTruthy();
  });

  it("renders danger state actions and invokes the callback", () => {
    const onAction = vi.fn();

    render(
      <StatusPanel
        title="We could not load your profile settings"
        description="Retry the load to continue."
        tone="danger"
        role="alert"
        announce="assertive"
        actionLabel="Retry loading profile"
        onAction={onAction}
      />,
    );

    const panel = screen.getByRole("alert", {
      name: /we could not load your profile settings/i,
    });
    expect(panel.getAttribute("aria-live")).toBe("assertive");

    fireEvent.click(screen.getByRole("button", { name: "Retry loading profile" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
