import axe from "axe-core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "../src/components/context-menu/contextMenu.js";

function TabDismissibleMenu() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button">Before menu</button>
      {open ? (
        <ContextMenu
          label="Available actions"
          position={{ x: 16, y: 24 }}
          onClose={() => setOpen(false)}
          commands={[{ name: "Run", action: vi.fn() }]}
        />
      ) : null}
      <button type="button">After menu</button>
    </>
  );
}

describe("ContextMenu", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs a command and closes menu", () => {
    const action = vi.fn();
    const onClose = vi.fn();

    render(
      <ContextMenu
        position={{ x: 16, y: 24 }}
        onClose={onClose}
        commands={[{ name: "Run", action }]}
      />
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Run" }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the first enabled command and skips disabled commands", () => {
    render(
      <ContextMenu
        position={{ x: 16, y: 24 }}
        onClose={vi.fn()}
        commands={[
          { name: "Unavailable", action: vi.fn(), disabled: true },
          { name: "First", action: vi.fn() },
          { name: "Second", action: vi.fn() },
        ]}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "First" }),
    );
  });

  it("supports wrapping arrow navigation and Home and End", () => {
    render(
      <ContextMenu
        position={{ x: 16, y: 24 }}
        onClose={vi.fn()}
        commands={[
          { name: "First", action: vi.fn() },
          { name: "Unavailable", action: vi.fn(), disabled: true },
          { name: "Last", action: vi.fn() },
        ]}
      />,
    );

    const menu = screen.getByRole("menu");
    const first = screen.getByRole("menuitem", { name: "First" });
    const last = screen.getByRole("menuitem", { name: "Last" });

    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "ArrowDown" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "End" });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(first);
  });

  it("preserves the active enabled command across equivalent rerenders", () => {
    const { rerender } = render(
      <ContextMenu
        label="Available actions"
        position={{ x: 16, y: 24 }}
        onClose={vi.fn()}
        commands={[
          { name: "First", action: vi.fn() },
          { name: "Last", action: vi.fn() },
        ]}
      />,
    );

    const last = screen.getByRole("menuitem", { name: "Last" });
    fireEvent.keyDown(
      screen.getByRole("menuitem", { name: "First" }),
      { key: "End" },
    );
    expect(document.activeElement).toBe(last);

    rerender(
      <ContextMenu
        label="Available actions"
        position={{ x: 24, y: 32 }}
        onClose={vi.fn()}
        commands={[
          { name: "First", action: vi.fn() },
          { name: "Last", action: vi.fn() },
        ]}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Last" }),
    );
  });

  it("moves focus predictably when the active command is disabled or removed", () => {
    const { rerender } = render(
      <ContextMenu
        label="Available actions"
        position={{ x: 16, y: 24 }}
        onClose={vi.fn()}
        commands={[
          { name: "First", action: vi.fn() },
          { name: "Middle", action: vi.fn() },
          { name: "Last", action: vi.fn() },
        ]}
      />,
    );

    const first = screen.getByRole("menuitem", { name: "First" });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Middle" }),
    );

    rerender(
      <ContextMenu
        label="Available actions"
        position={{ x: 16, y: 24 }}
        onClose={vi.fn()}
        commands={[
          { name: "First", action: vi.fn() },
          { name: "Middle", action: vi.fn(), disabled: true },
          { name: "Last", action: vi.fn() },
        ]}
      />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Last" }),
    );

    rerender(
      <ContextMenu
        label="Available actions"
        position={{ x: 16, y: 24 }}
        onClose={vi.fn()}
        commands={[{ name: "First", action: vi.fn() }]}
      />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "First" }),
    );
  });

  it("uses the dedicated Escape callback when provided", () => {
    const onClose = vi.fn();
    const onEscape = vi.fn();
    render(
      <ContextMenu
        position={{ x: 16, y: 24 }}
        onClose={onClose}
        onEscape={onEscape}
        commands={[{ name: "Run", action: vi.fn() }]}
      />,
    );

    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Run" }), {
      key: "Escape",
    });

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Tab after allowing the browser focus action", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <ContextMenu
        position={{ x: 16, y: 24 }}
        onClose={onClose}
        commands={[{ name: "Run", action: vi.fn() }]}
      />,
    );

    const tabAccepted = fireEvent.keyDown(
      screen.getByRole("menuitem", { name: "Run" }),
      { key: "Tab" },
    );

    expect(tabAccepted).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("preserves browser Tab focus while removing the menu", () => {
    vi.useFakeTimers();
    render(<TabDismissibleMenu />);

    const item = screen.getByRole("menuitem", { name: "Run" });
    const after = screen.getByRole("button", { name: "After menu" });
    expect(document.activeElement).toBe(item);

    expect(fireEvent.keyDown(item, { key: "Tab" })).toBe(true);
    expect(screen.getByRole("menu")).toBeTruthy();
    after.focus();
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(after);
  });

  it("focuses the accessibly named menu itself when every command is disabled", () => {
    render(
      <ContextMenu
        label="Unavailable actions"
        position={{ x: 16, y: 24 }}
        onClose={vi.fn()}
        commands={[
          { name: "Unavailable", action: vi.fn(), disabled: true },
        ]}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByRole("menu", { name: "Unavailable actions" }),
    );
  });

  it("supports direct and referenced accessible names without axe violations", async () => {
    const { container, rerender } = render(
      <section>
        <h2 id="menu-heading">Referenced actions</h2>
        <ContextMenu
          labelledBy="menu-heading"
          position={{ x: 16, y: 24 }}
          onClose={vi.fn()}
          commands={[{ name: "Run", action: vi.fn() }]}
        />
      </section>,
    );

    expect(
      screen.getByRole("menu", { name: "Referenced actions" }),
    ).toBeTruthy();
    expect((await axe.run(container)).violations).toEqual([]);

    rerender(
      <ContextMenu
        label="Direct actions"
        position={{ x: 16, y: 24 }}
        onClose={vi.fn()}
        commands={[{ name: "Run", action: vi.fn() }]}
      />,
    );
    expect(screen.getByRole("menu", { name: "Direct actions" })).toBeTruthy();
  });

  it("repositions menu inside viewport with padding", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 320,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 220,
    });

    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(120);

    render(
      <ContextMenu
        position={{ x: 310, y: 210 }}
        onClose={vi.fn()}
        commands={[{ name: "Run", action: vi.fn() }]}
      />
    );

    const menu = screen.getByRole("menu") as HTMLElement;
    expect(menu.style.left).toBe("108px");
    expect(menu.style.top).toBe("88px");
  });

  it("limits max menu dimensions to the available viewport space", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 180,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 140,
    });

    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(220);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(160);

    render(
      <ContextMenu
        position={{ x: 160, y: 130 }}
        onClose={vi.fn()}
        commands={[{ name: "Run", action: vi.fn() }]}
      />
    );

    const menu = screen.getByRole("menu") as HTMLElement;
    expect(menu.style.maxWidth).toBe("156px");
    expect(menu.style.maxHeight).toBe("116px");
    expect(menu.style.left).toBe("12px");
    expect(menu.style.top).toBe("12px");
  });
});
