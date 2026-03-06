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
- `ContactDetails`: reusable legal contact block with configurable details
- `ContextMenu`: generic context menu surface
- `UserProfile`: optional generic avatar/menu shell driven by callbacks
- `ConfirmationDialog`: reusable confirmation dialog with optional typed challenge flow for destructive actions
- Built-in interaction analytics forwarding through `@plasius/analytics`

## Install

```bash
npm install @plasius/sharedcomponents
```

## Module formats

This package publishes dual ESM and CJS artifacts.
When CJS output is emitted under `dist-cjs/*.js` with `type: module`, `dist-cjs/package.json` is generated with `{ "type": "commonjs" }` to ensure Node `require(...)` compatibility.


## Usage

```tsx
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
