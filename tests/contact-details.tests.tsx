import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContactDetails } from "../src/components/contact-details/contact-details.js";
import type { SharedComponentsMetadataInput } from "../src/metadata/white-label.js";
import { __resetSharedComponentsAnalyticsClientsForTests } from "../src/analytics/tracker.js";
import { analyticsTrackSpy, resetAnalyticsMocks } from "./analytics-mocks.js";

const fakeContactDetails = {
  teamName: "Platform Team",
  companyName: "Example Org",
  email: "platform@example.com",
  website: "https://example.com",
  websiteLabel: "example.com",
  addressLines: ["Line 1", "Line 2"],
};

const fakeMetadata: SharedComponentsMetadataInput = {
  organizationName: "Metadata Org",
  website: "https://metadata.example.com",
  websiteLabel: "metadata.example.com",
  contactEmail: "metadata@example.com",
  contactTeamName: "Metadata Team",
  contactAddressLines: ["Metadata Lane", "Suite 10"],
};

describe("ContactDetails", () => {
  afterEach(() => {
    resetAnalyticsMocks();
    __resetSharedComponentsAnalyticsClientsForTests();
  });

  it("renders details from injected data", () => {
    render(<ContactDetails metadata={fakeMetadata} details={fakeContactDetails} />);

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

  it("renders from shared metadata object", () => {
    render(<ContactDetails metadata={fakeMetadata} />);

    expect(screen.getByText("Metadata Team")).toBeTruthy();
    expect(screen.getByText("Metadata Org")).toBeTruthy();
    expect(screen.getByText("Metadata Lane")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "metadata@example.com" })
        .getAttribute("href")
    ).toBe("mailto:metadata@example.com");
  });

  it("supports top-level prop overrides for host compatibility", () => {
    render(
      <ContactDetails
        metadata={fakeMetadata}
        details={fakeContactDetails}
        companyName="Override Org"
        email="override@example.com"
      />
    );

    expect(screen.getByText("Override Org")).toBeTruthy();
    expect(screen.getByRole("link", { name: "override@example.com" })).toBeTruthy();
  });

  it("tracks email and website interactions when analytics is configured", () => {
    const metadataWithAnalytics: SharedComponentsMetadataInput = {
      ...fakeMetadata,
      analytics: {
        endpoint: "https://analytics.example.com/collect",
      },
    };

    render(<ContactDetails metadata={metadataWithAnalytics} />);

    const emailLink = screen.getByRole("link", { name: "metadata@example.com" });
    const websiteLink = screen.getByRole("link", { name: "metadata.example.com" });

    emailLink.click();
    websiteLink.click();

    expect(analyticsTrackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "ContactDetails",
        action: "email_click",
        label: "metadata@example.com",
      })
    );
    expect(analyticsTrackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "ContactDetails",
        action: "website_click",
        label: "metadata.example.com",
      })
    );
  });
});
