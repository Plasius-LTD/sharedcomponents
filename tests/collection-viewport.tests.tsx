import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { CollectionViewport, useProgressiveItems } from "../src/index.js";

const labels = {
  refresh: "Refresh", loadMore: "Load more", loading: "Loading more…",
  refreshing: "Refreshing…", pull: "Pull to refresh", release: "Release to refresh",
  end: "End of results", failed: "Unable to update. Try again.",
  refreshBlocked: "Save or cancel changes before refreshing.",
};
function geometry(element: HTMLElement, top = 400, height = 800, client = 400) {
  Object.defineProperties(element, {
    scrollTop: { configurable: true, writable: true, value: top },
    scrollHeight: { configurable: true, value: height },
    clientHeight: { configurable: true, value: client },
  });
}
function touch(x: number, y: number) { return { identifier: 1, clientX: x, clientY: y }; }
function pull(element: HTMLElement, distance = 100) {
  fireEvent.touchStart(element, { touches: [touch(20, 10)] });
  fireEvent.touchMove(element, { touches: [touch(20, 10 + distance)] });
  fireEvent.touchEnd(element, { touches: [] });
}
afterEach(cleanup);

describe("CollectionViewport", () => {
  it("appends only after user scrolls to the end and preserves focused rows", async () => {
    let resolve!: () => void;
    const onLoadMore = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const { rerender } = render(<CollectionViewport label="Flags" labels={labels} hasMore onLoadMore={onLoadMore}>
      <button>Existing flag</button>
    </CollectionViewport>);
    const region = screen.getByRole("region", { name: "Flags" });
    geometry(region, 0);
    const row = screen.getByRole("button", { name: "Existing flag" });
    row.focus();
    expect(onLoadMore).not.toHaveBeenCalled();
    fireEvent.scroll(region);
    expect(onLoadMore).not.toHaveBeenCalled();
    region.scrollTop = 400;
    fireEvent.scroll(region);
    fireEvent.wheel(region, { deltaY: 100 });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    rerender(<CollectionViewport label="Flags" labels={labels} hasMore onLoadMore={onLoadMore}>
      <button>Existing flag</button><button>Next flag</button>
    </CollectionViewport>);
    expect(document.activeElement).toBe(row);
    expect(region.scrollTop).toBe(400);
  });

  it("loads from a wheel or upward finger gesture when results do not fill the viewport", async () => {
    const more = vi.fn();
    render(<CollectionViewport label="Short list" labels={labels} hasMore onLoadMore={more}>Rows</CollectionViewport>);
    const region = screen.getByRole("region");
    geometry(region, 0, 200, 400);
    fireEvent.wheel(region, { deltaY: -100 });
    expect(more).not.toHaveBeenCalled();
    fireEvent.wheel(region, { deltaY: 100 });
    await waitFor(() => expect(more).toHaveBeenCalledTimes(1));
    await act(async () => {});
    pull(region, -100);
    await waitFor(() => expect(more).toHaveBeenCalledTimes(2));
  });

  it("refreshes only after a deliberate pull is released at the top", async () => {
    const refresh = vi.fn();
    render(<CollectionViewport label="Users" labels={labels} onRefresh={refresh}>Rows</CollectionViewport>);
    const region = screen.getByRole("region");
    geometry(region, 0);
    pull(region, 20);
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.touchStart(region, { touches: [touch(20, 10)] });
    fireEvent.touchMove(region, { touches: [touch(20, 110)] });
    expect(screen.getByText(labels.release)).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.touchEnd(region, { touches: [] });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("ignores cancelled, horizontal, multi-touch, non-top and editable gestures", () => {
    const refresh = vi.fn();
    render(<CollectionViewport label="Users" labels={labels} onRefresh={refresh}><input aria-label="Draft" /></CollectionViewport>);
    const region = screen.getByRole("region");
    geometry(region, 0);
    fireEvent.touchStart(region, { touches: [touch(20, 10)] });
    fireEvent.touchMove(region, { touches: [touch(120, 20)] });
    fireEvent.touchEnd(region);
    fireEvent.touchStart(region, { touches: [touch(20, 10), touch(50, 10)] });
    fireEvent.touchMove(region, { touches: [touch(20, 110)] });
    fireEvent.touchEnd(region);
    fireEvent.touchStart(region, { touches: [touch(20, 10)] });
    fireEvent.touchMove(region, { touches: [touch(20, 110)] });
    fireEvent.touchCancel(region);
    fireEvent.touchEnd(region);
    pull(screen.getByRole("textbox"));
    region.scrollTop = 10;
    pull(region);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not steal scrolling from nested scroll regions", () => {
    const refresh = vi.fn();
    const more = vi.fn();
    render(<CollectionViewport label="Outer" labels={labels} hasMore onLoadMore={more} onRefresh={refresh}>
      <div data-testid="nested" style={{ overflowY: "auto" }}>Nested</div>
    </CollectionViewport>);
    const region = screen.getByRole("region");
    geometry(region, 0, 200, 400);
    const nested = screen.getByTestId("nested");
    geometry(nested, 0, 800, 100);
    pull(nested);
    fireEvent.wheel(nested, { deltaY: 100 });
    expect(refresh).not.toHaveBeenCalled();
    expect(more).not.toHaveBeenCalled();
  });

  it("provides keyboard alternatives and protects drafts and commits", async () => {
    const refresh = vi.fn();
    const more = vi.fn();
    const { rerender } = render(<CollectionViewport label="Flags" labels={labels} hasMore onLoadMore={more} onRefresh={refresh} refreshDisabled>Rows</CollectionViewport>);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    pull(screen.getByRole("region"));
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText(labels.refreshBlocked)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(more).toHaveBeenCalledTimes(1));
    rerender(<CollectionViewport label="Flags" labels={labels} hasMore onLoadMore={more} onRefresh={refresh} disabled>Rows</CollectionViewport>);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(more).toHaveBeenCalledTimes(1);
    rerender(<CollectionViewport label="Flags" labels={labels} onRefresh={refresh}>Rows</CollectionViewport>);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Refresh" })));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(labels.end)).toBeTruthy();
  });

  it("retains rows after failure, does not retry itself, and permits explicit retry", async () => {
    const more = vi.fn().mockRejectedValueOnce(new Error("private error")).mockResolvedValue(undefined);
    render(<CollectionViewport label="Flags" labels={labels} hasMore onLoadMore={more}>Existing rows</CollectionViewport>);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Existing rows")).toBeTruthy();
    expect(screen.queryByText("private error")).toBeNull();
    expect(more).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Load more" })));
    expect(more).toHaveBeenCalledTimes(2);
  });

  it("resets scroll on a new query and aborts the old operation", async () => {
    let signal: AbortSignal | undefined;
    const more = vi.fn((value: AbortSignal) => { signal = value; return new Promise<void>(() => {}); });
    const { rerender } = render(<CollectionViewport label="Flags" labels={labels} hasMore onLoadMore={more} resetKey="first">Old rows</CollectionViewport>);
    const region = screen.getByRole("region");
    geometry(region);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    rerender(<CollectionViewport label="Flags" labels={labels} resetKey="second">New rows</CollectionViewport>);
    expect(signal?.aborted).toBe(true);
    expect(region.scrollTop).toBe(0);
    expect(screen.getByText(labels.end)).toBeTruthy();
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<CollectionViewport label="Flags" labels={labels} hasMore onLoadMore={vi.fn()} onRefresh={vi.fn()}><ul><li><button>Select flag</button></li></ul></CollectionViewport>);
    expect((await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});

describe("useProgressiveItems", () => {
  it("reveals sorted input in batches, resets on query change and keeps selected items available", () => {
    const items = Array.from({ length: 7 }, (_, index) => `Row ${index}`);
    function Example({ query = "a", selected = -1 }) {
      const page = useProgressiveItems(items, { resetKey: query, batchSize: 2, keepVisibleIndex: selected });
      return <><p>{page.items.join(", ")}</p><button disabled={!page.hasMore} onClick={page.loadMore}>More</button></>;
    }
    const { rerender } = render(<Example />);
    expect(screen.getByText("Row 0, Row 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Row 0, Row 1, Row 2, Row 3")).toBeTruthy();
    rerender(<Example query="b" />);
    expect(screen.getByText("Row 0, Row 1")).toBeTruthy();
    rerender(<Example query="b" selected={6} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
