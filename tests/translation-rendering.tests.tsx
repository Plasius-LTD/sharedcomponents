import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "../src/components/confirmation-dialog/ConfirmationDialog.js";
import { ContactDetails } from "../src/components/contact-details/contact-details.js";
import { Footer } from "../src/components/footer/Footer.js";
import { Header } from "../src/components/header/Header.js";
import { UserProfile } from "../src/components/user-profile/UserProfile.js";
import type { SharedComponentsMetadataInput } from "../src/metadata/white-label.js";
import { sharedComponentTranslationKeys } from "../src/i18n.js";

const translationHarness = vi.hoisted(() => ({
  values: {} as Record<string, string>,
  t: vi.fn((key: string, args: Record<string, string | number | boolean> = {}) => {
    const template = translationHarness.values[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_match, placeholder: string) => {
      const replacement = args[placeholder];
      return replacement === undefined ? `{${placeholder}}` : String(replacement);
    });
  }),
}));

vi.mock("@plasius/translations", () => ({
  useI18n: () => ({
    t: translationHarness.t,
  }),
}));

const fakeMetadata: SharedComponentsMetadataInput = {
  organizationName: "Metadata Org",
  contactEmail: "metadata@example.com",
  website: "https://metadata.example.com",
  websiteLabel: "metadata.example.com",
  contactTeamName: "Metadata Team",
  contactAddressLines: ["Metadata Lane"],
};

function useTranslatedLabels(values: Record<string, string>) {
  translationHarness.values = values;
}

describe("package-owned display text", () => {
  beforeEach(() => {
    translationHarness.values = {};
    translationHarness.t.mockClear();
  });

  it("uses translated defaults for header and footer chrome", () => {
    const currentYear = new Date().getFullYear();

    useTranslatedLabels({
      [sharedComponentTranslationKeys.header.primaryNavigation]:
        "Translated primary navigation",
      [sharedComponentTranslationKeys.header.home]: "Translated home",
      [sharedComponentTranslationKeys.header.toggleMenu]:
        "Translated navigation toggle",
      [sharedComponentTranslationKeys.footer.contactUs]: "Translated contact",
      [sharedComponentTranslationKeys.footer.toggleMenu]:
        "Translated footer toggle",
      [sharedComponentTranslationKeys.footer.rightsReserved]:
        "Translated rights for {companyName} in {year}.",
    });

    render(
      <>
        <Header
          metadata={fakeMetadata}
          items={[{ name: "About", url: "/about" }]}
        />
        <Footer
          metadata={fakeMetadata}
          companyName="Example Org"
          contactEmail="contact@example.com"
          items={[{ name: "Privacy", url: "/privacy" }]}
        />
      </>,
    );

    expect(
      screen.getByRole("navigation", { name: "Translated primary navigation" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Translated home" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("button", { name: "Translated navigation toggle" }),
    ).toBeTruthy();
    expect(
      screen.getByText(`Translated rights for Example Org in ${currentYear}.`),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Translated contact" }).getAttribute("href"),
    ).toBe("mailto:contact@example.com");
    expect(
      screen.getByRole("button", { name: "Translated footer toggle" }),
    ).toBeTruthy();
  });

  it("uses translated defaults for legal contact labels", () => {
    useTranslatedLabels({
      [sharedComponentTranslationKeys.contactDetails.inquiries]:
        "Translated inquiries:",
      [sharedComponentTranslationKeys.contactDetails.emailLabel]:
        "Translated email:",
      [sharedComponentTranslationKeys.contactDetails.websiteLabel]:
        "Translated website:",
    });

    render(<ContactDetails metadata={fakeMetadata} />);
    const address = screen.getByText("Metadata Team").closest("address");

    expect(address?.textContent).toContain("Translated inquiries:");
    expect(address?.textContent).toContain("Translated email:");
    expect(address?.textContent).toContain("Translated website:");
  });

  it("uses translated defaults for confirmation dialog controls", () => {
    useTranslatedLabels({
      [sharedComponentTranslationKeys.confirmationDialog.summaryTitle]:
        "Translated summary",
      [sharedComponentTranslationKeys.confirmationDialog.summaryEmpty]:
        "Translated review before continuing.",
      [sharedComponentTranslationKeys.confirmationDialog.challengeSectionLabel]:
        "Translated challenge",
      [sharedComponentTranslationKeys.confirmationDialog.challengeLabel]:
        "Translated challenge label",
      [sharedComponentTranslationKeys.confirmationDialog.challengePlaceholder]:
        "Translated challenge placeholder",
      [sharedComponentTranslationKeys.confirmationDialog.challengeHint]:
        "Translated enter exactly:",
      [sharedComponentTranslationKeys.confirmationDialog.confirmBusy]:
        "Translated submitting",
      [sharedComponentTranslationKeys.confirmationDialog.cancel]:
        "Translated cancel",
      [sharedComponentTranslationKeys.confirmationDialog.continue]:
        "Translated continue",
    });

    const { rerender } = render(
      <ConfirmationDialog
        open={true}
        title="Delete item?"
        challengeValue="DELETE"
        confirmLabel="Delete"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Translated summary" }),
    ).toBeTruthy();
    expect(screen.getByText("Translated review before continuing.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Translated continue" }));
    expect(
      screen.getByRole("region", { name: "Translated challenge" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Translated challenge label")).toBeTruthy();
    expect(screen.getByPlaceholderText("Translated challenge placeholder")).toBeTruthy();
    expect(screen.getByText("Translated enter exactly:")).toBeTruthy();

    rerender(
      <ConfirmationDialog
        open={true}
        title="Archive item?"
        confirmLabel="Archive"
        busy={true}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Translated submitting" }),
    ).toBeTruthy();
  });

  it("uses translated defaults for user profile actions", () => {
    const onLogin = vi.fn();

    useTranslatedLabels({
      [sharedComponentTranslationKeys.userProfile.openMenu]:
        "Translated user menu",
      [sharedComponentTranslationKeys.userProfile.fallbackFirstInitial]: "x",
      [sharedComponentTranslationKeys.userProfile.fallbackLastInitial]: "y",
      [sharedComponentTranslationKeys.userProfile.fallbackProvider]:
        "Translated provider",
      [sharedComponentTranslationKeys.userProfile.signInWithProvider]:
        "Translated sign in with {provider}",
    });

    render(<UserProfile onLogin={onLogin} providers={[""]} />);

    expect(screen.getByText("XY")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Translated user menu" }));
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: "Translated sign in with Translated provider",
      }),
    );

    expect(onLogin).toHaveBeenCalledWith("");
  });
});
