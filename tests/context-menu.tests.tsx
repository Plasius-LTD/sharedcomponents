import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "../src/components/context-menu/contextMenu.js";

describe("ContextMenu", () => {
  afterEach(() => {
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
