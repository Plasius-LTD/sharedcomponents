# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.11] - 2026-03-06

- **Added**
  - Added `ConfirmationDialog` component with reusable confirm/cancel UX, optional typed challenge flow, and danger/default action tones.
  - Added dialog tests covering two-step challenge flow, single-step confirmation mode, and Escape-to-cancel behavior.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.10] - 2026-03-04

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.9] - 2026-03-04

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.5] - 2026-03-01

- **Added**
  - Added embedded interaction analytics integration using `@plasius/analytics`.
  - Added `analytics` metadata contract (`endpoint`, `source`, `enabled`, `headers`, `context`) to white-label branding input.
  - Added analytics tests covering header, footer, contact details, and user profile interaction tracking.

- **Changed**
  - Instrumented `Header`, `Footer`, `ContactDetails`, and `UserProfile` interaction paths to emit analytics events when `metadata.analytics.endpoint` is configured.
  - Added optional branding metadata hook for components that can operate with or without provider metadata.
  - Updated README usage examples with white-label analytics endpoint configuration.

- **Fixed**
  - Enforced CommonJS runtime compatibility for dual-build output by generating and validating `dist-cjs/package.json` (`type: commonjs`) during build and package verification.
  - Ensured analytics metadata merges safely with provider- and component-level overrides.

- **Security**
  - (placeholder)

## [1.0.3] - 2026-02-28

- **Added**
  - Added `ContactDetails` `details` data object contract for host-driven content injection.
  - Added shared white-label metadata contracts/helpers (`SharedComponentsMetadataInput`) for cross-component branding injection.
  - Added `SharedComponentsBrandingProvider` and branding metadata hook for single-point white-label configuration.

- **Changed**
  - Refactored `ContactDetails` defaults to generic sample data and resolved values from injected props.
  - Updated `Footer` fallback metadata defaults to generic non-brand values.
  - Updated README examples to show host-provided organization/contact data.
  - `ContactDetails` and `Footer` now accept a common `metadata` object so host apps can configure branding/contact details once and reuse it across components.
  - `Header`, `Footer`, and `ContactDetails` now require a branding metadata reference via provider or `metadata` prop.

- **Fixed**
  - Updated contact/footer tests to use generic fake data and removed brand-specific assumptions.
  - Fixed header/footer/mobile context menu placement so burger popups clamp inside viewport bounds with consistent edge padding and narrow-screen size limits.

- **Security**
  - (placeholder)

## [1.0.2] - 2026-02-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.1] - 2026-02-12

- **Added**
  - Standalone public package scaffold at repository root with independent CI/CD, ADRs, and legal governance assets.
  - New component tests for header, footer, contact details, context menu, and user profile.
  - ADR-0003 documenting base-package dependency boundaries.
  - Base package suitability review document (`docs/base-package-review.md`).

- **Changed**
  - Add dual ESM + CJS build outputs with `exports` entries and CJS artifacts in `dist-cjs/`.
  - Refactored components to remove direct auth/profile/router coupling and rely on callback-driven composition.
  - Updated UI primitives and CSS contracts for consistent class mappings and accessibility-friendly controls.

- **Fixed**
  - Removed monorepo-relative TypeScript configuration coupling for standalone builds.
  - Corrected contact-details external website navigation to use standard links instead of router-specific `Link`.

- **Security**
  - Added baseline public package governance and CLA documentation.

---

## Release process (maintainers)

1. Update `CHANGELOG.md` under **Unreleased** with user-visible changes.
2. Bump version in `package.json` following SemVer (major/minor/patch).
3. Move entries from **Unreleased** to a new version section with the current date.
4. Tag the release in Git (`vX.Y.Z`) and push tags.
5. Publish to npm (via CI/CD or `npm publish`).

> Tip: Use Conventional Commits in PR titles/bodies to make changelog updates easier.

---

[Unreleased]: https://github.com/Plasius-LTD/sharedcomponents/compare/v1.0.11...HEAD

## [1.0.0] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
[1.0.1]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.1
[1.0.2]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.2
[1.0.3]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.3
[1.0.5]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.5
[1.0.9]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.9
[1.0.10]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.10
[1.0.11]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.11
