import axe from "axe-core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "../src/components/footer/Footer.js";
import { SharedComponentsBrandingProvider } from "../src/metadata/provider.js";
import type { SharedComponentsMetadataInput } from "../src/metadata/white-label.js";
import { __resetSharedComponentsAnalyticsClientsForTests } from "../src/analytics/tracker.js";
import { analyticsTrackSpy, resetAnalyticsMocks } from "./analytics-mocks.js";

const fakeFooterItems = [
  { name: "Privacy", url: "/privacy" },
  { name: "Docs", url: "https://example.com/docs", external: true },
];

const fakeMetadata: SharedComponentsMetadataInput = {
  organizationName: "Metadata Org",
  contactEmail: "metadata@example.com",
};

describe("Footer", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetAnalyticsMocks();
    __resetSharedComponentsAnalyticsClientsForTests();
    vi.restoreAllMocks();
  });

  it("renders provided metadata and links", () => {
    render(
      <Footer
        metadata={fakeMetadata}
        companyName="Acme Co"
        contactEmail="hello@example.com"
        items={fakeFooterItems}
      />
    );

    expect(screen.getByText(/Acme Co/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Contact us" }).getAttribute("href")
    ).toBe("mailto:hello@example.com");
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe(
      "/privacy"
    );
  });

  it("supports polished metal appearance and active navigation state", () => {
    const { container } = render(
      <Footer
        metadata={fakeMetadata}
        appearance="polishedMetal"
        activeHref="/privacy"
        items={fakeFooterItems}
      />
    );

    expect(container.querySelector("[class*='polishedMetal']")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Privacy" }).getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Docs" }).getAttribute("aria-current")
    ).toBeNull();
    screen.getByRole("link", { name: "Contact us" }).focus();
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Contact us" })
    );
  });

  it("renders branding directly from metadata object", () => {
    render(<Footer metadata={fakeMetadata} items={fakeFooterItems} />);

    expect(screen.getByText(/Metadata Org/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Contact us" }).getAttribute("href")
    ).toBe("mailto:metadata@example.com");
  });

  it("uses provider metadata when component metadata is omitted", () => {
    render(
      <SharedComponentsBrandingProvider metadata={fakeMetadata}>
        <Footer items={fakeFooterItems} />
      </SharedComponentsBrandingProvider>
    );

    expect(screen.getByText(/Metadata Org/)).toBeTruthy();
  });

  it("opens context menu from toggle and runs external command", () => {
    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null as unknown as Window);

    render(
      <Footer
        metadata={fakeMetadata}
        companyName="Acme Co"
        contactEmail="hello@example.com"
        items={fakeFooterItems}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle footer menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Docs" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/docs",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("closes the mobile context menu on Escape and restores toggle focus", () => {
    render(<Footer metadata={fakeMetadata} items={fakeFooterItems} />);

    const toggle = screen.getByRole("button", { name: "Toggle footer menu" });
    fireEvent.click(toggle);
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Privacy" }),
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("closes the mobile context menu when focus tabs away", () => {
    vi.useFakeTimers();
    render(<Footer metadata={fakeMetadata} items={fakeFooterItems} />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle footer menu" }));
    const firstItem = screen.getByRole("menuitem", { name: "Privacy" });
    expect(fireEvent.keyDown(firstItem, { key: "Tab" })).toBe(true);
    expect(screen.getByRole("menu")).toBeTruthy();
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("names the popup menu, exposes its relationship, and passes axe", async () => {
    const { container } = render(
      <Footer metadata={fakeMetadata} items={fakeFooterItems} />,
    );

    const toggle = screen.getByRole("button", {
      name: "Toggle footer menu",
    });
    expect(toggle.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(toggle);
    expect(
      screen.getByRole("menu", { name: "Toggle footer menu" }),
    ).toBeTruthy();

    const result = await axe.run(container, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    });
    expect(result.violations).toEqual([]);
  });

  it("runs internal mobile navigation commands", () => {
    render(<Footer metadata={fakeMetadata} items={fakeFooterItems} />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle footer menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Privacy" }));

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("tracks footer interactions when analytics is configured", () => {
    const metadataWithAnalytics: SharedComponentsMetadataInput = {
      ...fakeMetadata,
      analytics: {
        endpoint: "https://analytics.example.com/collect",
      },
    };

    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null as unknown as Window);

    render(<Footer metadata={metadataWithAnalytics} items={fakeFooterItems} />);

    fireEvent.click(screen.getByRole("link", { name: "Contact us" }));
    fireEvent.click(screen.getByRole("link", { name: "Privacy" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle footer menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Docs" }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(analyticsTrackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "Footer",
        action: "contact_click",
        label: "Contact us",
      })
    );
    expect(analyticsTrackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "Footer",
        action: "nav_click",
        label: "Privacy",
        variant: "desktop",
      })
    );
    expect(analyticsTrackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "Footer",
        action: "mobile_menu_toggle",
        variant: "open",
      })
    );
    expect(analyticsTrackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "Footer",
        action: "nav_click",
        label: "Docs",
        variant: "mobile",
      })
    );
  });

  it("renders and invokes discriminated icon actions on desktop and mobile", () => {
    const onSelect = vi.fn();
    const items = [
      { kind: "link" as const, id: "privacy", name: "Privacy", url: "/privacy" },
      {
        kind: "action" as const,
        id: "feedback",
        name: "Rate us or report a bug",
        icon: <span>!</span>,
        onSelect,
      },
    ];

    render(<Footer metadata={fakeMetadata} items={items} />);

    const action = screen.getByRole("button", {
      name: "Rate us or report a bug",
    });
    expect(action.getAttribute("data-footer-item-kind")).toBe("action");
    fireEvent.click(action);
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Toggle footer menu" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Rate us or report a bug" }),
    );
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("keeps disabled footer actions unavailable in both presentations", () => {
    const onSelect = vi.fn();
    render(
      <Footer
        metadata={fakeMetadata}
        items={[
          {
            kind: "action",
            id: "feedback",
            name: "Feedback unavailable",
            icon: <span>!</span>,
            disabled: true,
            onSelect,
          },
        ]}
      />,
    );

    expect(
      (screen.getByRole("button", {
        name: "Feedback unavailable",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Toggle footer menu" }));
    expect(document.activeElement).toBe(
      screen.getByRole("menu", { name: "Toggle footer menu" }),
    );
    expect(
      (screen.getByRole("menuitem", {
        name: "Feedback unavailable",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
