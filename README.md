# @plasius/sharedcomponents

[![npm version](https://img.shields.io/npm/v/@plasius/sharedcomponents.svg)](https://www.npmjs.com/package/@plasius/sharedcomponents)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/sharedcomponents/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/sharedcomponents/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/sharedcomponents)](https://codecov.io/gh/Plasius-LTD/sharedcomponents)
[![License](https://img.shields.io/github/license/Plasius-LTD/sharedcomponents)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Base React UI package for cross-application navigation and shared legal/contact UI.

## Scope

This package is intentionally a **base component layer**:

- No auth coupling
- No profile store coupling
- No environment/service coupling
- No router coupling in core components

If a product needs auth/profile behavior, wire it via callbacks/props from the host app.

## Included Components

- `Header`: configurable nav with optional profile slot and mobile context menu
- `Footer`: configurable legal/footer links with mobile context menu
- `StarRating`: controlled, touch-sized one-to-five native radiogroup
- `ConstrainedRichTextEditor`: lazy, allowlisted transient rich-text editor
- `ContactDetails`: reusable legal contact block with configurable details
- `ContextMenu`: generic context menu surface
- `ActionMenu`: controlled touch-first overflow menu with an anchored popover and phone-sheet presentation
- `ReviewSheet`: controlled modal review surface with responsive side-sheet and phone presentations
- `UserProfile`: optional generic avatar/menu shell driven by callbacks
- `ConfirmationDialog`: reusable confirmation dialog with optional typed challenge flow for destructive actions
- `StatusPanel`: reusable status/alert surface for loading, empty, warning, and retryable error states
- Built-in interaction analytics forwarding through `@plasius/analytics`
- Package-owned default display text resolved through `@plasius/translations`

## Install

```bash
npm install @plasius/sharedcomponents
```

## Module formats

This package publishes dual ESM and CJS artifacts.
When CJS output is emitted under `dist-cjs/*.js` with `type: module`, `dist-cjs/package.json` is generated with `{ "type": "commonjs" }` to ensure Node `require(...)` compatibility.


## Usage

```tsx
import { useState } from "react";
import {
  ContactDetails,
  Footer,
  Header,
  SharedComponentsBrandingProvider,
  UserProfile,
  type SharedComponentsMetadataInput,
} from "@plasius/sharedcomponents";

const navHeaderItems = [
  { name: "Hexagons", url: "/hexagons" },
  { name: "About", url: "/about" },
];

const navFooterItems = [
  { name: "Privacy", url: "/privacy" },
  { name: "Terms", url: "/terms-of-service" },
];

const sharedMetadata: SharedComponentsMetadataInput = {
  organizationName: "Example Organization",
  website: "https://example.com",
  websiteLabel: "example.com",
  contactEmail: "legal@example.com",
  contactTeamName: "Legal Team",
  contactAddressLines: ["123 Example Street", "Sample City", "Sample Region", "00000"],
  analytics: {
    endpoint: "https://analytics.example.com/collect",
    source: "@plasius/sharedcomponents",
    context: {
      tenant: "example-tenant",
      environment: "production",
    },
  },
};

<SharedComponentsBrandingProvider metadata={sharedMetadata}>
  <Header
    items={navHeaderItems}
    brand={<img src="/brand-logo.svg" alt="Example Organization Logo" />}
    profileSlot={
      <UserProfile
        user={{ firstName: "Ada", lastName: "Lovelace" }}
        onOpenSettings={() => console.info("settings")}
        onLogout={() => console.info("logout")}
        onLogin={(provider) => console.info("login", provider)}
      />
    }
  />

  <Footer items={navFooterItems} />

  <ContactDetails />
</SharedComponentsBrandingProvider>;
```

`Header`, `Footer`, and `ContactDetails` require a branding metadata reference.
Provide it once with `SharedComponentsBrandingProvider` (recommended), or per component using the `metadata` prop.

## Touch-first action and review surfaces

`ActionMenu` and `ReviewSheet` are controlled presentation components. The host
owns open state, authorization, draft state, validation, and persistence. At
widths above `40rem`, `ActionMenu` is anchored to its trigger and `ReviewSheet`
is a modal right-side overlay. At `40rem` and below, both adapt to full-width
touch sheets. The review surface contains keyboard focus, blocks background
interaction, and identifies itself as modal at every presentation width.

```tsx
import {
  ActionMenu,
  ReviewSheet,
  type ReviewSheetCloseReason,
} from "@plasius/sharedcomponents";

const [actionsOpen, setActionsOpen] = useState(false);
const [reviewOpen, setReviewOpen] = useState(false);

function closeReview(_reason: ReviewSheetCloseReason) {
  setReviewOpen(false);
}

<ActionMenu
  open={actionsOpen}
  label="User actions"
  triggerLabel="Open user actions"
  trigger={<span aria-hidden="true">•••</span>}
  items={[
    {
      id: "review",
      label: "Review change",
      onSelect: () => setReviewOpen(true),
    },
    {
      id: "remove",
      label: "Remove avatar",
      tone: "danger",
      onSelect: () => setReviewOpen(true),
    },
  ]}
  onOpenChange={setActionsOpen}
/>;

<ReviewSheet
  open={reviewOpen}
  title="Review user change"
  description="Check the before and after values before committing."
  closeLabel="Close review"
  onClose={closeReview}
  footer={<button type="button">Commit change</button>}
>
  <dl>{/* caller-owned review details */}</dl>
</ReviewSheet>;
```

Both components provide 44×44 CSS-pixel minimum touch targets, Escape and
outside-pointer dismissal, safe-area padding, reduced-motion handling,
high-contrast focus indicators, and caller-translatable accessible labels.
`ActionMenu` implements wrapping arrow, Home, and End navigation and returns
focus to its trigger. `ReviewSheet` reports why close was requested and returns
focus for explicit close, Escape, and outside dismissal.

See [Touch-first action surfaces](./docs/touch-first-action-surfaces.md) for the
complete API and host responsibilities. The coordinate-based `ContextMenu`
accepts either `label` or `labelledBy` so callers can name the menu. Its Tab
dismissal runs after the browser's native focus action, avoiding focus loss
when the popup is removed. It preserves the active enabled command across
structurally equivalent rerenders and moves to the next enabled command, then
the preceding command, when the active command becomes unavailable. Header,
Footer, and UserProfile menus expose their popup relationship and return focus
to their opener on Escape.

## Privacy-safe feedback controls

`Footer` accepts explicit links and host-owned actions. Actions render as
44×44 native buttons on desktop and as disabled-aware mobile menu commands:

```tsx
const feedbackItems = [
  {
    kind: "link" as const,
    id: "privacy",
    name: "Privacy",
    url: "/privacy",
  },
  {
    kind: "action" as const,
    id: "feedback",
    name: "Rate us or report a bug",
    icon: <span aria-hidden="true">★</span>,
    onSelect: () => setFeedbackOpen(true),
  },
];

<Footer items={feedbackItems} />;
```

Only the exact action ID `feedback` emits action telemetry. The package sends
the fixed `feedback_open` event and desktop/mobile variant through a
context-isolated client; it does not send the caller-owned label, URL, route,
branding metadata, or arbitrary analytics context. Other footer actions are
not tracked by the component.

`StarRating` exposes exactly five caller-translated native radio options with
Arrow/Home/End keyboard behavior and visible shape, border, and text state.
`ConstrainedRichTextEditor` is dynamically loaded and emits only the transient
feedback AST: paragraphs or bullet items, depths 0–4, and bold/italic/underline
text leaves. Its exact 4,000-Unicode-code-point budget includes inter-block
newlines and is bounded again at 8,000 UTF-16 code units.

```tsx
import {
  ConstrainedRichTextEditor,
  StarRating,
  type FeedbackRichTextDocument,
  type StarRatingValue,
} from "@plasius/sharedcomponents";

const [rating, setRating] = useState<StarRatingValue | null>(null);
const [narrative, setNarrative] =
  useState<FeedbackRichTextDocument | null>(null);

<StarRating
  label="Overall satisfaction"
  labels={["Very poor", "Poor", "Fair", "Good", "Excellent"]}
  value={rating}
  onChange={setRating}
  required
/>;

<ConstrainedRichTextEditor
  labels={{
    editor: "Tell us more",
    toolbar: "Text formatting",
    bold: "Bold",
    italic: "Italic",
    underline: "Underline",
    bullets: "Bulleted list",
    indent: "Increase indent",
    outdent: "Decrease indent",
    loading: "Loading editor",
  }}
  placeholder="Optional details"
  value={narrative}
  onChange={setNarrative}
/>;
```

The editor uses no `innerHTML`, `dangerouslySetInnerHTML`, or `execCommand`.
Paste is plain text only; links, images, attachments, code, mentions, embedded
metadata, HTML/link syntax, arbitrary formatting, and drops are not
represented. The AST and
`extractFeedbackRichText` output remain sensitive live-browser data: hosts must
redact, validate, and encrypt before sending, and must never log, persist,
cache, or attach them to analytics.

Cancelable edits are admitted through a native `beforeinput` listener. Any
unintercepted `input` outside an active validated composition is rolled back to
the canonical model without emitting `onChange`. Mutation commands require a
freshly mapped browser selection; cached ranges are never used as a fallback.
Canonical recovery keeps the textbox element mounted, does not report an
internal blur, and restores focus only when focus has not genuinely left.

Caret-only empty paragraphs/list items remain private to the mounted editor.
They count toward the limits but are never emitted; `onChange` receives only a
canonical AST whose blocks and text leaves are non-empty.

Runtime model helpers are intentionally isolated from the root entry so the
editor model, editing state, and full stylesheet do not join the application
shell. Import model helpers only inside the lazy feedback flow:

```tsx
import {
  extractFeedbackRichText,
  normaliseFeedbackRichTextDocument,
} from "@plasius/sharedcomponents/feedback-rich-text-model";
```

See [Privacy-safe feedback primitives](./docs/privacy-safe-feedback-primitives.md)
and [ADR-0005](./docs/adrs/adr-0005-privacy-constrained-feedback-primitives.md)
for the complete host boundary and schema-compatibility contract.

Release gate: the feedback editor must consume the published
`@plasius/schema ^1.4.0` Unicode-profile helper before this change is released.
The staged runtime Unicode checks are not a substitute for the pinned profile
and must not ship independently.

## Translations

Package-owned labels, default action names, accessibility labels, and fallback helper text are exposed as `en-GB` dictionaries and resolved through `@plasius/translations`.
Components keep English fallback defaults when a host has not loaded the package dictionary, while host applications can load or override the same keys through the shared translator.

```tsx
import { getTranslator } from "@plasius/translations";
import { sharedComponentsTranslations } from "@plasius/sharedcomponents";

const i18n = getTranslator();

for (const [language, dictionary] of Object.entries(sharedComponentsTranslations)) {
  i18n.loadTranslations(language, dictionary);
}
```

## Interaction Analytics

When `metadata.analytics.endpoint` is configured, sharedcomponents automatically tracks user interactions for:

- Header nav, brand click, and mobile menu flows
- Footer contact/nav clicks and mobile menu flows
- Contact details email/website clicks
- User profile avatar/menu command interactions (when branding metadata is available)

This keeps analytics endpoint configuration in one white-label metadata object.

## Suitability Checklist

Use `@plasius/sharedcomponents` as your base package when your component:

- is reusable across products
- can be configured only through props/callbacks
- does not import product/domain stores
- does not require backend/service SDKs directly

Do not add components here if they need app-specific business logic or service wiring.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
npm run test:coverage
```

## Governance & ADRs

- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- ADRs: [docs/adrs](./docs/adrs)
- Base package review: [docs/base-package-review.md](./docs/base-package-review.md)
- Legal docs: [legal](./legal)

## License

MIT

<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

CI keeps the administrative contributor registry outside Git and npm package
artifacts using exact, case-normalised path checks. External fork heads are
rejected; same-repository pull requests validate on GitHub-hosted runners and
main pushes validate on approved self-hosted runners. Release preparation and
publication use a two-run exact-main protocol on GitHub-hosted Node.js 24.18.0
LTS. A read-only job seals the package tarball and SBOM before a dependency-free
production job publishes that exact artifact through npm OIDC with provenance;
there is no npm write-token fallback. CD remains disabled until the npm trusted
publisher binding and protected-branch-only production environment are
independently verified.
<!-- END PLASIUS RELEASE INTEGRITY -->
