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

## Install

```bash
npm install @plasius/sharedcomponents
```

## Usage

```tsx
import { Footer, Header, UserProfile } from "@plasius/sharedcomponents";
import { PlasiusLTDLogo } from "@plasius/sharedassets";

const navHeaderItems = [
  { name: "Hexagons", url: "/hexagons" },
  { name: "About", url: "/about" },
];

const navFooterItems = [
  { name: "Privacy", url: "/privacy" },
  { name: "Terms", url: "/terms-of-service" },
];

<Header
  items={navHeaderItems}
  brand={<img src={PlasiusLTDLogo} alt="Plasius LTD Logo" />}
  profileSlot={
    <UserProfile
      user={{ firstName: "Ada", lastName: "Lovelace" }}
      onOpenSettings={() => console.info("settings")}
      onLogout={() => console.info("logout")}
      onLogin={(provider) => console.info("login", provider)}
    />
  }
/>;

<Footer items={navFooterItems} />;
```

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
