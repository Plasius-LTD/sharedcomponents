import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionMenu,
  type ActionMenuItem,
} from "../src/index.js";

const originalMatchMedia = window.matchMedia;
const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

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

function renderControlledActionMenu(
  items: readonly ActionMenuItem[],
  initialOpen = false,
) {
  function Example() {
    const [open, setOpen] = React.useState(initialOpen);

    return (
      <ActionMenu
        open={open}
        label="User actions"
        triggerLabel="Open user actions"
        trigger={<span aria-hidden="true">•••</span>}
        items={items}
        onOpenChange={setOpen}
      />
    );
  }

  return render(<Example />);
}

describe("ActionMenu", () => {
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
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it("opens from a controlled touch target and focuses the first enabled action", () => {
    installMatchMedia(false);

    renderControlledActionMenu([
      { id: "disabled", label: "Unavailable", disabled: true, onSelect: vi.fn() },
      { id: "edit", label: "Edit user", onSelect: vi.fn() },
    ]);

    const trigger = screen.getByRole("button", { name: "Open user actions" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu", { name: "User actions" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Edit user" })).toBe(
      document.activeElement,
    );
  });

  it("supports wraparound arrow, Home, and End keyboard navigation", () => {
    installMatchMedia(false);

    renderControlledActionMenu(
      [
        { id: "first", label: "First action", onSelect: vi.fn() },
        { id: "disabled", label: "Disabled action", disabled: true, onSelect: vi.fn() },
        { id: "last", label: "Last action", onSelect: vi.fn() },
      ],
      true,
    );

    const menu = screen.getByRole("menu", { name: "User actions" });
    const first = screen.getByRole("menuitem", { name: "First action" });
    const last = screen.getByRole("menuitem", { name: "Last action" });

    expect(first).toBe(document.activeElement);

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(last).toBe(document.activeElement);

    fireEvent.keyDown(menu, { key: "Home" });
    expect(first).toBe(document.activeElement);

    fireEvent.keyDown(menu, { key: "End" });
    expect(last).toBe(document.activeElement);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(first).toBe(document.activeElement);
  });

  it("opens with Arrow Up and focuses the last enabled action", () => {
    installMatchMedia(false);

    renderControlledActionMenu([
      { id: "first", label: "First action", onSelect: vi.fn() },
      { id: "last", label: "Last action", onSelect: vi.fn() },
    ]);

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Open user actions" }),
      { key: "ArrowUp" },
    );

    expect(screen.getByRole("menuitem", { name: "Last action" })).toBe(
      document.activeElement,
    );
  });

  it("positions the popover against the trigger and flips it above viewport overflow", () => {
    installMatchMedia(false);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 400,
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 400,
      y: 340,
      left: 400,
      top: 340,
      right: 444,
      bottom: 384,
      width: 44,
      height: 44,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(180);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(120);

    renderControlledActionMenu(
      [{ id: "edit", label: "Edit", onSelect: vi.fn() }],
      true,
    );

    const menu = screen.getByRole("menu") as HTMLElement;
    expect(menu.style.left).toBe("264px");
    expect(menu.style.top).toBe("212px");
  });

  it("keeps the current menu item focused when controlled items are re-created", () => {
    installMatchMedia(false);
    const onOpenChange = vi.fn();
    const createItems = (): readonly ActionMenuItem[] => [
      { id: "first", label: "First action", onSelect: vi.fn() },
      { id: "last", label: "Last action", onSelect: vi.fn() },
    ];

    const { rerender } = render(
      <ActionMenu
        open={true}
        label="User actions"
        triggerLabel="Open user actions"
        trigger={<span aria-hidden="true">•••</span>}
        items={createItems()}
        onOpenChange={onOpenChange}
      />,
    );

    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "End" });
    const last = screen.getByRole("menuitem", { name: "Last action" });
    expect(last).toBe(document.activeElement);

    rerender(
      <ActionMenu
        open={true}
        label="User actions"
        triggerLabel="Open user actions"
        trigger={<span aria-hidden="true">•••</span>}
        items={createItems()}
        onOpenChange={onOpenChange}
      />,
    );

    expect(last).toBe(document.activeElement);
  });

  it("focuses an empty menu surface and leaves disabled triggers closed", () => {
    installMatchMedia(false);
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <ActionMenu
        open={true}
        label="User actions"
        triggerLabel="Open user actions"
        trigger={<span aria-hidden="true">•••</span>}
        items={[]}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole("menu")).toBe(document.activeElement);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });

    rerender(
      <ActionMenu
        open={false}
        label="User actions"
        triggerLabel="Open user actions"
        trigger={<span aria-hidden="true">•••</span>}
        items={[]}
        disabled={true}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open user actions" }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("selects an action, closes, and returns focus to the trigger", () => {
    installMatchMedia(false);
    const onSelect = vi.fn();

    renderControlledActionMenu(
      [{ id: "remove", label: "Remove avatar", tone: "danger", onSelect }],
      true,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Remove avatar" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Open user actions" })).toBe(
      document.activeElement,
    );
  });

  it("closes on Escape and outside pointer input with focus return", () => {
    installMatchMedia(false);

    const { rerender } = render(
      <ActionMenu
        open={true}
        label="User actions"
        triggerLabel="Open user actions"
        trigger={<span aria-hidden="true">•••</span>}
        items={[{ id: "edit", label: "Edit", onSelect: vi.fn() }]}
        onOpenChange={vi.fn()}
      />,
    );

    const onEscapeChange = vi.fn();
    rerender(
      <ActionMenu
        open={true}
        label="User actions"
        triggerLabel="Open user actions"
        trigger={<span aria-hidden="true">•••</span>}
        items={[{ id: "edit", label: "Edit", onSelect: vi.fn() }]}
        onOpenChange={onEscapeChange}
      />,
    );

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(onEscapeChange).toHaveBeenCalledWith(false);

    const onOutsideChange = vi.fn();
    rerender(
      <ActionMenu
        open={true}
        label="User actions"
        triggerLabel="Open user actions"
        trigger={<span aria-hidden="true">•••</span>}
        items={[{ id: "edit", label: "Edit", onSelect: vi.fn() }]}
        onOpenChange={onOutsideChange}
      />,
    );

    const backdrop = screen.getByRole("menu").parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(backdrop as HTMLElement);
    expect(onOutsideChange).toHaveBeenCalledWith(false);
  });

  it("closes on Tab without forcing focus and ignores unrelated trigger keys", () => {
    installMatchMedia(false);
    const onOpenChange = vi.fn();

    render(
      <ActionMenu
        open={true}
        label="User actions"
        triggerLabel="Open user actions"
        trigger={<span aria-hidden="true">•••</span>}
        items={[{ id: "edit", label: "Edit", onSelect: vi.fn() }]}
        onOpenChange={onOpenChange}
      />,
    );

    const menuItem = screen.getByRole("menuitem", { name: "Edit" });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(menuItem).toBe(document.activeElement);

    onOpenChange.mockClear();
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Open user actions" }),
      { key: "PageDown" },
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("switches to the full-width phone presentation when the media query changes", () => {
    const media = installMatchMedia(false);

    renderControlledActionMenu(
      [{ id: "edit", label: "Edit", onSelect: vi.fn() }],
      true,
    );

    const menu = screen.getByRole("menu");
    expect(menu.getAttribute("data-presentation")).toBe("popover");

    act(() => {
      media.setMatches(true);
    });

    expect(menu.getAttribute("data-presentation")).toBe("sheet");
  });
});
