import * as React from "react";
import axe from "axe-core";
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

  it("renders a labelled modal side sheet and focuses its close action", () => {
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
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("data-presentation")).toBe("side");
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByText("Confirm the new display name.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close review" })).toBe(
      document.activeElement,
    );
  });

  it("passes WCAG 2.2 AA axe rules in the desktop modal presentation", async () => {
    installMatchMedia(false);

    const { container } = render(
      <ReviewSheet
        open={true}
        title="Review user change"
        description="Confirm the proposed change."
        closeLabel="Close review"
        onClose={vi.fn()}
        footer={<button type="button">Commit change</button>}
      >
        <p>Before and after</p>
      </ReviewSheet>,
    );

    const result = await axe.run(container, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    });
    expect(result.violations).toEqual([]);
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

  it("blocks the outside pointer default and restores opener focus after close", () => {
    installMatchMedia(false);
    const outsideClick = vi.fn();

    function Example() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Edit user
          </button>
          <button type="button" onClick={outsideClick}>
            Next target
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

    const nextTarget = screen.getByRole("button", { name: "Next target" });
    expect(fireEvent.pointerDown(nextTarget)).toBe(false);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toBe(document.activeElement);
    expect(outsideClick).not.toHaveBeenCalled();
  });

  it("contains Tab focus in the desktop side-sheet presentation", () => {
    installMatchMedia(false);

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

    closeButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(commitButton).toBe(document.activeElement);

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toBe(document.activeElement);
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

  it("keeps modality while changing between side and phone presentations", () => {
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
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("data-presentation")).toBe("side");

    act(() => {
      media.setMatches(true);
    });

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("data-presentation")).toBe("phone");
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
