import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "../src/components/footer/Footer.js";

describe("Footer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders company metadata and links", () => {
    render(
      <Footer
        companyName="Acme Co"
        contactEmail="hello@example.com"
        items={[{ name: "Privacy", url: "/privacy" }]}
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

  it("opens context menu from toggle and runs command", () => {
    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null as unknown as Window);

    render(
      <Footer
        items={[{ name: "Docs", url: "https://example.com/docs", external: true }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle footer menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Docs" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/docs",
      "_blank",
      "noopener,noreferrer"
    );
  });
});
