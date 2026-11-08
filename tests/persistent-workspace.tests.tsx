import * as React from "react";
import axe from "axe-core";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersistentWorkspace, type WorkspaceLabels } from "../src/index.js";

const labels: WorkspaceLabels = {
  navigation: "Games", selection: "Game selection", options: "Instructions and options", viewport: "Game viewport",
  expandNavigation: "Expand games", collapseNavigation: "Collapse games", expandOptions: "Expand options", collapseOptions: "Collapse options",
  closeContext: "Close context", openItem: (name) => `Open ${name}`,
};
const originalMedia = window.matchMedia;
function media(initial = false) {
  const callbacks = new Set<() => void>();
  const query = { matches: initial, addEventListener: (_event: string, fn: () => void) => callbacks.add(fn), removeEventListener: (_event: string, fn: () => void) => callbacks.delete(fn) };
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => query });
  return { change(matches: boolean) { act(() => { query.matches = matches; callbacks.forEach((fn) => fn()); }); }, callbacks };
}
const items = (onSelect = vi.fn()) => [{ id: "first", label: "First game", icon: <span>1</span>, onSelect }, { id: "second", label: "Second game", icon: <span>2</span>, onSelect }];
const options = [{ id: "instructions", label: "Instructions", content: <p>Move in three axes</p> }, { id: "settings", label: "Settings", content: <label>Volume<input defaultValue="50" /></label> }];
function Example({ onSelect = vi.fn() }: { onSelect?: () => void }) {
  return <PersistentWorkspace active="first" title="Original arcade" labels={labels} items={items(onSelect)} options={options} navigation={<label>Search games<input defaultValue="saved" /></label>}>
    <canvas data-testid="game-canvas" /><button type="button">Pause game</button>
  </PersistentWorkspace>;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMedia }); });

describe("PersistentWorkspace", () => {
  it("keeps canvas and form state mounted while panels collapse independently", () => {
    media(); const { container } = render(<Example />); const canvas = screen.getByTestId("game-canvas");
    const search = screen.getByLabelText("Search games"); fireEvent.change(search, { target: { value: "kept" } });
    fireEvent.click(screen.getByRole("button", { name: "Collapse games" }));
    expect(container.querySelector("[data-navigation-collapsed='true']")).toBeTruthy();
    expect(container.querySelector("[data-options-collapsed='false']")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse options" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand games" }));
    expect(screen.getByLabelText("Search games")).toBe(search); expect((search as HTMLInputElement).value).toBe("kept");
    expect(container.querySelector("[data-options-collapsed='true']")).toBeTruthy();
    expect(screen.getByTestId("game-canvas")).toBe(canvas);
  });
  it("requires a context action before a collapsed navigation item changes the game", () => {
    media(); const onSelect = vi.fn(); render(<Example onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse games" }));
    const trigger = screen.getByRole("button", { name: "Second game" }); fireEvent.click(trigger);
    expect(onSelect).not.toHaveBeenCalled(); const menu = screen.getByRole("menu", { name: "Second game" });
    fireEvent.keyDown(menu, { key: "Escape" }); expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); fireEvent.click(screen.getByRole("menuitem", { name: "Open Second game" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
  it("can expand navigation from its context menu and select a docked item", () => {
    media(); const onSelect = vi.fn(); render(<Example onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse games" }));
    fireEvent.click(screen.getByRole("button", { name: "First game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Expand games" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Collapse games" }));
    fireEvent.click(screen.getByRole("button", { name: "First game" })); expect(onSelect).toHaveBeenCalledTimes(1);
  });
  it("preserves option state and restores trigger focus on Escape or close", () => {
    media(); render(<Example />); fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const volume = screen.getByLabelText("Volume"); fireEvent.change(volume, { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Collapse options" }));
    const trigger = screen.getByRole("button", { name: "Settings" }); fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Settings" }); expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(dialog, { key: "Escape" }); expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); expect(screen.getByLabelText("Volume")).toBe(volume); expect((volume as HTMLInputElement).value).toBe("75");
    fireEvent.click(screen.getByRole("button", { name: "Close context" })); expect(document.activeElement).toBe(trigger);
  });
  it("dismisses floating navigation on outside interaction without stealing focus", () => {
    media(); render(<Example />); fireEvent.click(screen.getByRole("button", { name: "Collapse games" }));
    const trigger = screen.getByRole("button", { name: "Game selection" }); fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Game selection" })).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Pause game" })); expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger); act(() => screen.getByRole("button", { name: "Pause game" }).focus());
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pause game" }));
  });
  it("supports independent compact disclosures, Escape and resize without remounting", () => {
    const query = media(true); const { unmount } = render(<Example />); const canvas = screen.getByTestId("game-canvas");
    const navigation = screen.getByRole("button", { name: "Games" });
    // An explicit name excludes decorative CSS disclosure symbols in browsers.
    expect(navigation.getAttribute("aria-label")).toBe("Games"); fireEvent.click(navigation);
    expect(screen.getByLabelText("Search games")).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText("Search games"), { key: "Escape" }); expect(document.activeElement).toBe(navigation);
    const optionsToggle = screen.getByRole("button", { name: "Instructions and options" });
    expect(optionsToggle.getAttribute("aria-label")).toBe("Instructions and options"); fireEvent.click(optionsToggle);
    expect(screen.getByText("Move in three axes")).toBeTruthy();
    fireEvent.keyDown(screen.getByText("Move in three axes"), { key: "Escape" }); expect(document.activeElement).toBe(optionsToggle);
    query.change(false); expect(screen.getByRole("button", { name: "Collapse games" })).toBeTruthy();
    expect(screen.getByTestId("game-canvas")).toBe(canvas); unmount(); expect(query.callbacks.size).toBe(0);
  });
  it("uses distinct IDs and works with no option panes or navigation supplement", () => {
    media(); const { container } = render(<><PersistentWorkspace active="first" title="One" labels={labels} items={items()} options={[]}><canvas /></PersistentWorkspace>
      <PersistentWorkspace active="second" title="Two" labels={labels} items={items()} options={[]}><canvas /></PersistentWorkspace></>);
    const ids = Array.from(container.querySelectorAll("[id]")).map((node) => node.id); expect(new Set(ids).size).toBe(ids.length);
    expect(screen.queryAllByRole("complementary")).toHaveLength(0);
  });
  it("preserves native modified-link navigation and handles ordinary selection", () => {
    media(); const onSelect = vi.fn();
    render(<PersistentWorkspace active="first" title="Linked game" labels={labels}
      items={[{ id: "first", label: "First game", href: "#first", onSelect }]} options={[]}><canvas /></PersistentWorkspace>);
    const link = screen.getByRole("link", { name: "First game" });
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(fireEvent.click(link, { shiftKey: true })).toBe(true);
    expect(fireEvent.click(link, { altKey: true })).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    expect(fireEvent.click(link)).toBe(false); expect(onSelect).toHaveBeenCalledTimes(1);
  });
  it("falls back when a selected option disappears and dismisses old-game context", () => {
    media(); const { rerender } = render(<PersistentWorkspace active="first" title="One" labels={labels} items={items()} options={options}><canvas /></PersistentWorkspace>);
    fireEvent.click(screen.getByRole("button", { name: "Settings" })); fireEvent.click(screen.getByRole("button", { name: "Collapse options" })); fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    rerender(<PersistentWorkspace active="second" title="Two" labels={labels} items={items()} options={[options[0]!]}><canvas /></PersistentWorkspace>);
    expect(screen.queryByRole("dialog")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Instructions" }));
    expect(within(screen.getByRole("dialog")).getByText("Move in three axes")).toBeTruthy();
  });
  it("passes WCAG 2.2 AA semantic checks in docked and floating presentations", async () => {
    media(); const { container } = render(<Example />);
    const run = () => axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
    expect((await run()).violations).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Collapse options" })); fireEvent.click(screen.getByRole("button", { name: "Instructions" }));
    expect((await run()).violations).toEqual([]);
  });
});
