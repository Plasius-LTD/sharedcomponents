import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SemanticJourneyEventInput } from "@plasius/analytics";
import {
  ActionMenu, CollectionViewport, ConfirmationDialog, ContactDetails, Footer, Header,
  PersistentWorkspace, SharedComponentsBrandingProvider, StatusPanel, UserProfile,
} from "../src/index.js";
import { __resetSharedComponentsAnalyticsClientsForTests } from "../src/analytics/tracker.js";
import { createAnalyticsClientSpy, resetAnalyticsMocks } from "./analytics-mocks.js";

const canary = "PRIVATE-COMPONENT-821";
const metadata = {
  organizationName: canary,
  contactEmail: `${canary}@example.test`,
  website: `https://example.test/${canary}`,
  analytics: { endpoint: "https://example.test/legacy" },
};
const attribute = "data-plasius-event";
const navigation = "ui.navigation.select";
const activate = "ui.control.activate";
const menuOpen = "ui.menu.open";
const menuClose = "ui.menu.close";
const cancel = "ui.action.cancel";
const closeDialog = "ui.dialog.close";

async function observe(events: SemanticJourneyEventInput[], enabled = true) {
  const { defineSemanticJourneyCatalog, observeSemanticJourneyInteractions } =
    await vi.importActual<typeof import("@plasius/analytics")>("@plasius/analytics");
  // The admitted subset of the host catalogue, not a package-owned catalogue.
  const catalogue = defineSemanticJourneyCatalog({
    [navigation]: { category: "navigation" },
    [activate]: { category: "interaction" },
    [menuOpen]: { category: "interaction" },
    [menuClose]: { category: "interaction" },
    [cancel]: { category: "interaction" },
    [closeDialog]: { category: "interaction" },
  }, { sources: ["plasius.site"] });
  return observeSemanticJourneyInteractions({ catalogue, enabled, onEvent: (event) => events.push(event) });
}

function activateNative(element: HTMLElement, modality: "pointer" | "keyboard" | "touch" | "programmatic") {
  if (modality === "programmatic") {
    act(() => element.click());
    return;
  }
  if (modality === "touch") {
    fireEvent(element, new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
    return;
  }
  // The native click that follows keyboard or pointer activation.
  fireEvent.click(element, { detail: modality === "keyboard" ? 0 : 1 });
}

describe("shared semantic interaction markers", () => {
  afterEach(() => {
    cleanup();
    __resetSharedComponentsAnalyticsClientsForTests();
    resetAnalyticsMocks();
    vi.restoreAllMocks();
  });

  it.each(["pointer", "keyboard", "touch", "programmatic"] as const)(
    "uses the same registered navigation action for %s, preserving the callback",
    async (modality) => {
      const events: SemanticJourneyEventInput[] = [];
      const stop = await observe(events);
      const onNavigate = vi.fn((_item, _href, event: { preventDefault(): void }) => event.preventDefault());
      try {
        render(
          <SharedComponentsBrandingProvider metadata={metadata} semanticInteractionMarkers>
            <Header items={[{ name: canary, url: `/#${canary}` }]} onNavigate={onNavigate} />
          </SharedComponentsBrandingProvider>,
        );
        const link = screen.getByRole("link", { name: canary });
        activateNative(link, modality);
        expect(link.getAttribute("href")).toBe(`/#${canary}`);
        expect(onNavigate).toHaveBeenCalledTimes(1);
        expect(events.map(({ name }) => name)).toEqual([navigation]);
        expect(events[0]).not.toHaveProperty("target");
        expect(JSON.stringify(events)).not.toContain(canary);
        expect(createAnalyticsClientSpy).not.toHaveBeenCalled();
      } finally {
        stop();
      }
    },
  );

  it("marks contact and profile actions without leaking branding or account fields", async () => {
    const events: SemanticJourneyEventInput[] = [];
    const stop = await observe(events);
    const onSelect = vi.fn();
    const preventLinkNavigation = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("click", preventLinkNavigation);
    try {
      render(
        <SharedComponentsBrandingProvider metadata={metadata} semanticInteractionMarkers>
          <ContactDetails />
          <UserProfile user={{ firstName: canary, lastName: canary, avatarUrl: metadata.website }}
            signedInCommands={[{ name: canary, action: onSelect }]} />
        </SharedComponentsBrandingProvider>,
      );
      fireEvent.click(screen.getByRole("link", { name: metadata.contactEmail }));
      const toggle = screen.getByRole("button", { name: "Open user menu" });
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(toggle.getAttribute(attribute)).toBe(menuClose);
      fireEvent.click(screen.getByRole("menuitem", { name: canary }));
      expect(events.map(({ name }) => name)).toEqual([navigation, menuOpen, activate]);
      expect(onSelect).toHaveBeenCalledOnce();
      expect(JSON.stringify(events)).not.toContain(canary);
      expect(createAnalyticsClientSpy).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("click", preventLinkNavigation);
      stop();
    }
  });

  it("captures ordinary footer navigation, including mobile, and leaves the feedback journey untouched", async () => {
    const events: SemanticJourneyEventInput[] = [];
    const stop = await observe(events);
    const onFeedback = vi.fn();
    vi.spyOn(window, "open").mockImplementation(() => null);
    try {
      render(
        <SharedComponentsBrandingProvider metadata={metadata} semanticInteractionMarkers>
          <Footer items={[
            { name: "Policy", url: metadata.website, external: true },
            { kind: "action", id: "feedback", name: "Feedback", icon: null, onSelect: onFeedback },
          ]} onNavigate={(_item, _href, event) => event.preventDefault()} />
        </SharedComponentsBrandingProvider>,
      );
      fireEvent.click(screen.getByRole("link", { name: "Policy" }));
      fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
      const toggle = screen.getByRole("button", { name: "Toggle footer menu" });
      fireEvent.click(toggle);
      fireEvent.click(screen.getByRole("menuitem", { name: "Feedback" }));
      fireEvent.click(toggle);
      fireEvent.click(screen.getByRole("menuitem", { name: "Policy" }));
      expect(onFeedback).toHaveBeenCalledTimes(2);
      expect(events.map(({ name }) => name)).toEqual([navigation, navigation]);
      expect(JSON.stringify(events)).not.toContain(canary);
      expect(createAnalyticsClientSpy).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });

  it("keeps capture controlled by the host, including rollback with legacy collection disabled", async () => {
    const events: SemanticJourneyEventInput[] = [];
    const stop = await observe(events, false);
    const fixture = (enabled?: boolean) => (
      <SharedComponentsBrandingProvider
        metadata={{ ...metadata, analytics: { ...metadata.analytics, enabled: false } }}
        semanticInteractionMarkers={enabled}
      >
        <Header items={[{ name: "Policy", url: "#policy" }]} />
      </SharedComponentsBrandingProvider>
    );
    try {
      const view = render(fixture(true));
      const link = screen.getByRole("link", { name: "Policy" });
      expect(link.getAttribute(attribute)).toBe(navigation);
      fireEvent.click(link);
      view.rerender(fixture());
      expect(link.hasAttribute(attribute)).toBe(false);
      fireEvent.click(link);
      expect(events).toEqual([]);
      expect(createAnalyticsClientSpy).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });

  it("marks action-menu and confirmation buttons but leaves the challenge value and input unobserved", async () => {
    function Menu() {
      const [open, setOpen] = useState(false);
      return <ActionMenu open={open} label="Actions" triggerLabel="Open actions" trigger="Open"
        items={[{ id: canary, label: canary, onSelect: onSelect }]} onOpenChange={setOpen} />;
    }
    const events: SemanticJourneyEventInput[] = [];
    const stop = await observe(events);
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    try {
      const view = render(<SharedComponentsBrandingProvider metadata={metadata} semanticInteractionMarkers>
        <Menu />
      </SharedComponentsBrandingProvider>);
      fireEvent.click(screen.getByRole("button", { name: "Open actions" }));
      fireEvent.click(screen.getByRole("menuitem", { name: canary }));
      expect(onSelect).toHaveBeenCalledOnce();

      view.rerender(<SharedComponentsBrandingProvider metadata={metadata} semanticInteractionMarkers>
        <ConfirmationDialog open title="Confirm action" challengeValue={canary}
          confirmLabel="Confirm" onCancel={onCancel} onConfirm={vi.fn()} />
      </SharedComponentsBrandingProvider>);
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
      const challenge = within(dialog).getByRole("textbox");
      fireEvent.change(challenge, { target: { value: canary } });
      expect(challenge.hasAttribute(attribute)).toBe(false);
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(onCancel).toHaveBeenCalledOnce();
      expect(events.map(({ name }) => name)).toEqual([menuOpen, activate, activate, cancel]);
      expect(JSON.stringify(events)).not.toContain(canary);
      expect(createAnalyticsClientSpy).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });

  it("marks built-in collection, status and workspace actions without marking host-owned content", async () => {
    const events: SemanticJourneyEventInput[] = [];
    const stop = await observe(events);
    const onRefresh = vi.fn();
    const onSelect = vi.fn();
    const onRetry = vi.fn();
    const labels = {
      navigation: "Games", selection: "Selection", options: "Options", viewport: "Game viewport",
      expandNavigation: "Expand games", collapseNavigation: "Collapse games",
      expandOptions: "Expand options", collapseOptions: "Collapse options", closeContext: "Close panel",
      openItem: () => "Open game",
    };
    try {
      render(<SharedComponentsBrandingProvider metadata={metadata} semanticInteractionMarkers>
        <CollectionViewport label="Rows" labels={{
          refresh: "Refresh rows", loadMore: "Load more", loading: "Loading", refreshing: "Refreshing",
          pull: "Pull", release: "Release", end: "End", failed: "Failed", refreshBlocked: "Blocked",
        }} onRefresh={onRefresh}>Rows</CollectionViewport>
        <StatusPanel title="Status" description={canary} actionLabel="Retry" onAction={onRetry} />
        <PersistentWorkspace active={canary} title="Workspace" labels={labels}
          items={[{ id: canary, label: "Select game", onSelect }]}
          options={[{ id: canary, label: "Settings", content: <input aria-label="Volume" defaultValue={canary} /> }]}>
          <button type="button">Host action</button>
        </PersistentWorkspace>
      </SharedComponentsBrandingProvider>);
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Refresh rows" })));
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      fireEvent.click(screen.getByRole("button", { name: "Select game" }));
      fireEvent.click(screen.getByRole("button", { name: "Host action" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Volume" }), { target: { value: "new-" + canary } });
      expect(events.map(({ name }) => name)).toEqual([activate, activate, navigation]);
      expect(onRefresh).toHaveBeenCalledOnce();
      expect(onRetry).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledOnce();
      expect(JSON.stringify(events)).not.toContain(canary);
    } finally {
      stop();
    }
  });
});
