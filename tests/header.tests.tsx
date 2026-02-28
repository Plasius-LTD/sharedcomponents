import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "../src/components/header/Header.js";
import type { SharedComponentsMetadataInput } from "../src/metadata/white-label.js";

const fakeMetadata: SharedComponentsMetadataInput = {
  organizationName: "Metadata Org",
  contactEmail: "metadata@example.com",
};

describe("Header", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders navigation items and custom brand content", () => {
    render(
      <Header
        metadata={fakeMetadata}
        brand={<span>Brand</span>}
        items={[
          { name: "About", url: "/about" },
          { name: "Docs", url: "https://example.com/docs", external: true },
        ]}
      />
    );

    expect(screen.getByText("Brand")).toBeTruthy();
    expect(screen.getByRole("link", { name: "About" }).getAttribute("href")).toBe(
      "/about"
    );
    expect(screen.getByRole("link", { name: "Docs" }).getAttribute("target")).toBe(
      "_blank"
    );
  });

  it("opens mobile context menu and executes external link command", () => {
    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null as unknown as Window);

    render(
      <Header
        metadata={fakeMetadata}
        items={[{ name: "External", url: "https://example.com", external: true }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle navigation menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "External" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("requires branding metadata reference", () => {
    expect(() =>
      render(<Header items={[{ name: "About", url: "/about" }]} />)
    ).toThrow(/requires branding metadata/i);
  });
});
