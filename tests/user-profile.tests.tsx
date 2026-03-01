import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserProfile } from "../src/components/user-profile/UserProfile.js";
import { SharedComponentsBrandingProvider } from "../src/metadata/provider.js";
import { __resetSharedComponentsAnalyticsClientsForTests } from "../src/analytics/tracker.js";
import { analyticsTrackSpy, resetAnalyticsMocks } from "./analytics-mocks.js";

afterEach(() => {
  resetAnalyticsMocks();
  __resetSharedComponentsAnalyticsClientsForTests();
});

describe("UserProfile", () => {
  it("shows provider actions when no user is present", () => {
    const onLogin = vi.fn();
    render(<UserProfile onLogin={onLogin} providers={["google"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign in with Google" }));

    expect(onLogin).toHaveBeenCalledWith("google");
  });

  it("shows settings and logout when user is present", () => {
    const onOpenSettings = vi.fn();
    const onLogout = vi.fn();
    render(
      <UserProfile
        user={{ firstName: "Ada", lastName: "Lovelace" }}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Logout" }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("tracks avatar and menu command interactions when branding analytics is available", () => {
    const onLogin = vi.fn();

    render(
      <SharedComponentsBrandingProvider
        metadata={{
          organizationName: "Metadata Org",
          website: "https://example.com",
          websiteLabel: "example.com",
          contactEmail: "metadata@example.com",
          contactTeamName: "Metadata Team",
          contactAddressLines: ["Metadata Lane"],
          analytics: {
            endpoint: "https://analytics.example.com/collect",
          },
        }}
      >
        <UserProfile onLogin={onLogin} providers={["google"]} />
      </SharedComponentsBrandingProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign in with Google" }));

    expect(analyticsTrackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "UserProfile",
        action: "avatar_toggle",
        variant: "open",
      })
    );
    expect(analyticsTrackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "UserProfile",
        action: "menu_command",
        label: "Sign in with Google",
      })
    );
  });
});
