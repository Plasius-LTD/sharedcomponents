import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactDetails } from "../src/components/contact-details/contact-details.js";

const fakeContactDetails = {
  teamName: "Platform Team",
  companyName: "Example Org",
  email: "platform@example.com",
  website: "https://example.com",
  websiteLabel: "example.com",
  addressLines: ["Line 1", "Line 2"],
};

describe("ContactDetails", () => {
  it("renders details from injected data", () => {
    render(<ContactDetails details={fakeContactDetails} />);

    expect(screen.getByText(fakeContactDetails.teamName)).toBeTruthy();
    expect(screen.getByText(fakeContactDetails.companyName)).toBeTruthy();
    expect(screen.getByText("Line 1")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: fakeContactDetails.email })
        .getAttribute("href")
    ).toBe(`mailto:${fakeContactDetails.email}`);
    expect(
      screen
        .getByRole("link", { name: fakeContactDetails.websiteLabel })
        .getAttribute("href")
    ).toBe(fakeContactDetails.website);
  });

  it("supports top-level prop overrides for host compatibility", () => {
    render(
      <ContactDetails
        details={fakeContactDetails}
        companyName="Override Org"
        email="override@example.com"
      />
    );

    expect(screen.getByText("Override Org")).toBeTruthy();
    expect(screen.getByRole("link", { name: "override@example.com" })).toBeTruthy();
  });
});
