import type {
  TranslationArgs,
  TranslationDictionary,
  TranslationValue,
} from "@plasius/translations";
import { sharedComponentsEnGbTranslations } from "./translations/en-GB.js";

export const sharedComponentTranslationKeys = {
  confirmationDialog: {
    summaryTitle: "sharedComponents.confirmationDialog.summary.title",
    summaryEmpty: "sharedComponents.confirmationDialog.summary.empty",
    challengeSectionLabel:
      "sharedComponents.confirmationDialog.challenge.sectionLabel",
    challengeLabel: "sharedComponents.confirmationDialog.challenge.label",
    challengePlaceholder:
      "sharedComponents.confirmationDialog.challenge.placeholder",
    challengeHint: "sharedComponents.confirmationDialog.challenge.hint",
    confirmBusy: "sharedComponents.confirmationDialog.action.confirmBusy",
    cancel: "sharedComponents.confirmationDialog.action.cancel",
    continue: "sharedComponents.confirmationDialog.action.continue",
  },
  contactDetails: {
    inquiries: "sharedComponents.contactDetails.inquiries",
    emailLabel: "sharedComponents.contactDetails.email.label",
    websiteLabel: "sharedComponents.contactDetails.website.label",
  },
  footer: {
    rightsReserved: "sharedComponents.footer.rightsReserved",
    contactUs: "sharedComponents.footer.contactUs",
    toggleMenu: "sharedComponents.footer.toggleMenu",
  },
  header: {
    primaryNavigation: "sharedComponents.header.primaryNavigation",
    home: "sharedComponents.header.home",
    toggleMenu: "sharedComponents.header.toggleMenu",
  },
  userProfile: {
    openMenu: "sharedComponents.userProfile.openMenu",
    avatarAlt: "sharedComponents.userProfile.avatar.alt",
    fallbackFirstInitial: "sharedComponents.userProfile.initial.first.fallback",
    fallbackLastInitial: "sharedComponents.userProfile.initial.last.fallback",
    fallbackProvider: "sharedComponents.userProfile.provider.fallback",
    settings: "sharedComponents.userProfile.command.settings",
    logout: "sharedComponents.userProfile.command.logout",
    signInWithProvider: "sharedComponents.userProfile.command.signInWithProvider",
  },
} as const;

type LeafValues<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? LeafValues<T[keyof T]>
    : never;

export type SharedComponentTranslationKey =
  LeafValues<typeof sharedComponentTranslationKeys>;

export type SharedComponentTranslationResolver = (
  key: SharedComponentTranslationKey,
  args?: TranslationArgs
) => string;

export type SharedComponentRuntimeTranslator = (
  key: string,
  args?: TranslationArgs
) => string;

export { sharedComponentsEnGbTranslations };

export const sharedComponentsTranslations = {
  "en-GB": sharedComponentsEnGbTranslations,
} as const satisfies Partial<Record<string, TranslationDictionary>>;

function renderTranslationValue(
  value: TranslationValue | undefined,
  args: TranslationArgs,
): string | null {
  if (typeof value === "function") {
    return value(args);
  }

  if (typeof value === "string") {
    return value.replace(/\{(\w+)\}/g, (_match, placeholder: string) => {
      const replacement = args[placeholder];
      return replacement !== undefined ? String(replacement) : `{${placeholder}}`;
    });
  }

  return null;
}

export function getSharedComponentDefaultTranslation(
  key: SharedComponentTranslationKey,
  args: TranslationArgs = {},
): string {
  return renderTranslationValue(sharedComponentsEnGbTranslations[key], args) ?? key;
}

export function resolveSharedComponentTranslation(
  translator: SharedComponentRuntimeTranslator,
  key: SharedComponentTranslationKey,
  args: TranslationArgs = {},
): string {
  const translated = translator(key, args);
  return translated === key
    ? getSharedComponentDefaultTranslation(key, args)
    : translated;
}

export function createSharedComponentTranslationResolver(
  translator: SharedComponentRuntimeTranslator,
): SharedComponentTranslationResolver {
  return (key, args) => resolveSharedComponentTranslation(translator, key, args);
}
