import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactDetails } from "../src/components/contact-details/contact-details.js";

describe("ContactDetails", () => {
  it("renders defaults", () => {
    render(<ContactDetails />);

    expect(screen.getByText("Web Development Team")).toBeTruthy();
    expect(screen.getByText("Plasius LTD")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "web@plasius.co.uk" }).getAttribute("href")
    ).toBe("mailto:web@plasius.co.uk");
  });

  it("renders custom address and website values", () => {
    render(
      <ContactDetails
        teamName="Platform Team"
        companyName="Example Org"
        email="platform@example.com"
        website="https://example.com"
        websiteLabel="example.com"
        addressLines={["Line 1", "Line 2"]}
      />
    );

    expect(screen.getByText("Platform Team")).toBeTruthy();
    expect(screen.getByText("Example Org")).toBeTruthy();
    expect(screen.getByText("Line 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "example.com" }).getAttribute("href")).toBe(
      "https://example.com"
    );
  });
});
