import type { SharedComponentTranslationKey } from "../i18n.js";

export const sharedComponentsEnGbTranslations = {
  "sharedComponents.confirmationDialog.summary.title": "Summary",
  "sharedComponents.confirmationDialog.summary.empty":
    "Review this action before continuing.",
  "sharedComponents.confirmationDialog.challenge.sectionLabel":
    "Confirmation challenge",
  "sharedComponents.confirmationDialog.challenge.label":
    "Type the confirmation value to continue",
  "sharedComponents.confirmationDialog.challenge.placeholder":
    "Type confirmation value",
  "sharedComponents.confirmationDialog.challenge.hint": "Enter exactly:",
  "sharedComponents.confirmationDialog.action.confirmBusy": "Submitting...",
  "sharedComponents.confirmationDialog.action.cancel": "Cancel",
  "sharedComponents.confirmationDialog.action.continue": "Continue",
  "sharedComponents.contactDetails.inquiries":
    "For inquiries, please contact:",
  "sharedComponents.contactDetails.email.label": "Email:",
  "sharedComponents.contactDetails.website.label": "Website:",
  "sharedComponents.footer.rightsReserved":
    "\u00a9 {year} {companyName}. All rights reserved.",
  "sharedComponents.footer.contactUs": "Contact us",
  "sharedComponents.footer.toggleMenu": "Toggle footer menu",
  "sharedComponents.header.primaryNavigation": "Primary navigation",
  "sharedComponents.header.home": "Home",
  "sharedComponents.header.toggleMenu": "Toggle navigation menu",
  "sharedComponents.userProfile.openMenu": "Open user menu",
  "sharedComponents.userProfile.avatar.alt": "Avatar",
  "sharedComponents.userProfile.initial.first.fallback": "U",
  "sharedComponents.userProfile.initial.last.fallback": "P",
  "sharedComponents.userProfile.provider.fallback": "Provider",
  "sharedComponents.userProfile.command.settings": "Settings",
  "sharedComponents.userProfile.command.logout": "Logout",
  "sharedComponents.userProfile.command.signInWithProvider":
    "Sign in with {provider}",
} as const satisfies Record<SharedComponentTranslationKey, string>;
