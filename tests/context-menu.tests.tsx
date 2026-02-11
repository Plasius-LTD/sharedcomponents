import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextMenu } from "../src/components/context-menu/contextMenu.js";

describe("ContextMenu", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
