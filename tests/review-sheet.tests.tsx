import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewSheet } from "../src/index.js";

const originalMatchMedia = window.matchMedia;

interface MatchMediaController {
  setMatches: (matches: boolean) => void;
}

function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string): MediaQueryList => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      },
      removeEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    })),
  });

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches, media: "(max-width: 40rem)" } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

describe("ReviewSheet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalMatchMedia) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    } else {
      Reflect.deleteProperty(window, "matchMedia");
    }
    document.body.style.overflow = "";
  });

  it("does not render dialog content while closed", () => {
    installMatchMedia(false);

    render(
      <ReviewSheet
        open={false}
        title="Review user change"
        closeLabel="Close review"
        onClose={vi.fn()}
      >
        <p>Change details</p>
      </ReviewSheet>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a labelled non-modal side sheet and focuses its close action", () => {
    installMatchMedia(false);

    render(
      <ReviewSheet
        open={true}
        title="Review user change"
        description="Confirm the new display name."
        closeLabel="Close review"
        onClose={vi.fn()}
      >
        <p>Before and after</p>
      </ReviewSheet>,
    );

    const dialog = screen.getByRole("dialog", { name: "Review user change" });
    expect(dialog.getAttribute("aria-modal")).toBeNull();
    expect(dialog.getAttribute("data-presentation")).toBe("side");
    expect(screen.getByText("Confirm the new display name.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close review" })).toBe(
      document.activeElement,
    );
  });

  it("closes on Escape and restores focus after the controlled sheet closes", () => {
    installMatchMedia(false);

    function Example() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Edit user
          </button>
          <ReviewSheet
            open={open}
            title="Review user change"
            closeLabel="Close review"
            onClose={() => setOpen(false)}
          >
            <p>Change details</p>
          </ReviewSheet>
        </>
      );
    }

    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Edit user" });

    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });

  it("allows an outside pointer target to receive focus while requesting close", () => {
    installMatchMedia(false);
    const onClose = vi.fn();

    render(
      <>
        <button type="button">Next target</button>
        <ReviewSheet
          open={true}
          title="Review user change"
          closeLabel="Close review"
          onClose={onClose}
        >
          <p>Change details</p>
        </ReviewSheet>
      </>,
    );

    const nextTarget = screen.getByRole("button", { name: "Next target" });
    fireEvent.pointerDown(nextTarget);
    nextTarget.focus();
    fireEvent.click(nextTarget);

    expect(onClose).toHaveBeenCalledWith("outside");
    expect(nextTarget).toBe(document.activeElement);
  });

  it("uses an aria-modal phone sheet, locks body scroll, and contains Tab focus", () => {
    installMatchMedia(true);

    render(
      <ReviewSheet
        open={true}
        title="Review user change"
        closeLabel="Close review"
        onClose={vi.fn()}
        footer={<button type="button">Commit change</button>}
      >
        <button type="button">Inspect consequence</button>
      </ReviewSheet>,
    );

    const dialog = screen.getByRole("dialog", { name: "Review user change" });
    const closeButton = screen.getByRole("button", { name: "Close review" });
    const commitButton = screen.getByRole("button", { name: "Commit change" });

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("data-presentation")).toBe("phone");
    expect(document.body.style.overflow).toBe("hidden");

    closeButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(commitButton).toBe(document.activeElement);

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toBe(document.activeElement);
  });

  it("updates modality when the phone media query changes", () => {
    const media = installMatchMedia(false);

    render(
      <ReviewSheet
        open={true}
        title="Review user change"
        closeLabel="Close review"
        onClose={vi.fn()}
      >
        <p>Change details</p>
      </ReviewSheet>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBeNull();

    act(() => {
      media.setMatches(true);
    });

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("blocks close interactions while busy", () => {
    installMatchMedia(false);
    const onClose = vi.fn();

    render(
      <ReviewSheet
        open={true}
        title="Review user change"
        closeLabel="Close review"
        busy={true}
        onClose={onClose}
      >
        <p>Change details</p>
      </ReviewSheet>,
    );

    expect(
      screen.getByRole("button", { name: "Close review" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("dialog")).toBe(document.activeElement);

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerDown(document.body);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("reports explicit close reasons and supports disabling dismiss paths", () => {
    installMatchMedia(false);
    const onClose = vi.fn();

    const { rerender } = render(
      <ReviewSheet
        open={true}
        title="Review user change"
        closeLabel="Close review"
        onClose={onClose}
      >
        <p>Change details</p>
      </ReviewSheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close review" }));
    expect(onClose).toHaveBeenCalledWith("close-button");

    onClose.mockClear();
    rerender(
      <ReviewSheet
        open={true}
        title="Review user change"
        closeLabel="Close review"
        dismissOnEscape={false}
        dismissOnOutside={false}
        onClose={onClose}
      >
        <p>Change details</p>
      </ReviewSheet>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });
});
