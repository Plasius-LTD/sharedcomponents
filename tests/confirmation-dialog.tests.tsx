import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "../src/components/confirmation-dialog/ConfirmationDialog.js";

describe("ConfirmationDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a two-step confirmation challenge and blocks confirm until typed value matches", async () => {
    const onConfirm = vi.fn(async () => {});

    render(
      <ConfirmationDialog
        open={true}
        title="Delete feature flag?"
        description="This action is destructive."
        summaryItems={["Impact A", "Impact B"]}
        challengeLabel='Type "DELETE FEATURE FLAG" to continue'
        challengeValue="DELETE FEATURE FLAG"
        confirmLabel="Delete"
        tone="danger"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("alertdialog", { name: /delete feature flag/i })).toBeTruthy();
    expect(screen.getByText("Impact A")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const confirmButton = screen.getByRole("button", { name: "Delete" });
    const input = screen.getByLabelText(/Type "DELETE FEATURE FLAG" to continue/i);

    expect(confirmButton.hasAttribute("disabled")).toBe(true);

    fireEvent.change(input, {
      target: {
        value: "delete feature flag",
      },
    });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);

    fireEvent.change(input, {
      target: {
        value: "DELETE FEATURE FLAG",
      },
    });
    expect(confirmButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("supports one-step confirm when no challenge value is provided", async () => {
    const onConfirm = vi.fn(async () => {});

    render(
      <ConfirmationDialog
        open={true}
        title="Archive item?"
        confirmLabel="Archive"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("cancels on Escape when dialog is open and not busy", () => {
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        open={true}
        title="Confirm action"
        confirmLabel="Confirm"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, {
      key: "Escape",
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
