import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserProfile } from "../src/components/user-profile/UserProfile.js";

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
});
