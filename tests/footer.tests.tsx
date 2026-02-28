import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "../src/components/footer/Footer.js";
import { SharedComponentsBrandingProvider } from "../src/metadata/provider.js";
import type { SharedComponentsMetadataInput } from "../src/metadata/white-label.js";

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
});
