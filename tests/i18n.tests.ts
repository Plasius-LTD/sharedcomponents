import { createI18n } from "@plasius/translations";
import { describe, expect, it } from "vitest";
import {
  getSharedComponentDefaultTranslation,
  resolveSharedComponentTranslation,
  sharedComponentTranslationKeys,
  sharedComponentsEnGbTranslations,
  sharedComponentsTranslations,
} from "../src/i18n.js";

describe("shared component translations", () => {
  it("exports package-owned en-GB dictionaries for the shared translator", () => {
    const i18n = createI18n({
      language: "en-GB",
      fallback: "en-GB",
      translations: sharedComponentsTranslations,
    });

    expect(i18n.t(sharedComponentTranslationKeys.header.home)).toBe("Home");
    expect(
      i18n.t(sharedComponentTranslationKeys.footer.rightsReserved, {
        year: 2026,
        companyName: "Example Ltd",
      }),
    ).toBe("\u00a9 2026 Example Ltd. All rights reserved.");
  });

  it("resolves package defaults when the active translator has not loaded a key", () => {
    const translator = (key: string) => key;

    expect(
      resolveSharedComponentTranslation(
        translator,
        sharedComponentTranslationKeys.userProfile.signInWithProvider,
        {
          provider: "Google",
        },
      ),
    ).toBe("Sign in with Google");
  });

  it("renders function-valued dictionaries and falls back to the key when missing", () => {
    const key = sharedComponentTranslationKeys.header.home;
    const dictionary = sharedComponentsEnGbTranslations as unknown as Record<
      string,
      unknown
    >;
    const original = dictionary[key];

    try {
      dictionary[key] = ({ label }: { label: string }) => `Function ${label}`;

      expect(
        getSharedComponentDefaultTranslation(key, {
          label: "value",
        }),
      ).toBe("Function value");
      expect(resolveSharedComponentTranslation(() => "Translated", key)).toBe(
        "Translated",
      );
      expect(
        getSharedComponentDefaultTranslation(
          "sharedComponents.missing.key" as Parameters<
            typeof getSharedComponentDefaultTranslation
          >[0],
        ),
      ).toBe("sharedComponents.missing.key");
    } finally {
      dictionary[key] = original;
    }
  });

  it("interpolates placeholders from package defaults", () => {
    expect(
      getSharedComponentDefaultTranslation(
        sharedComponentTranslationKeys.footer.rightsReserved,
        {
          year: 2026,
          companyName: "Example Org",
        },
      ),
    ).toBe("\u00a9 2026 Example Org. All rights reserved.");
    expect(
      getSharedComponentDefaultTranslation(
        sharedComponentTranslationKeys.userProfile.signInWithProvider,
        {},
      ),
    ).toBe("Sign in with {provider}");
  });
});
