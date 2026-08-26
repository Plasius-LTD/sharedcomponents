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
  - Keep a real pointer activation of the open footer trigger from being
    consumed first as a context-menu outside click, so one activation closes
    the menu instead of closing and immediately reopening it (task #39).

- **Security**
  - Keep the complete mobile feedback path outside package analytics by
    suppressing the prerequisite footer-menu toggle when an enabled item has
    the reserved feedback identity, and keep that identity private across item
    representations. Capture feedback eligibility for each open menu and
    require a fresh telemetry-free open if feedback becomes enabled; keep an
    already-private close private after revocation without changing unrelated
    or disabled-item footer analytics (task #39).

## [1.1.1] - 2026-08-13

- **Added**
  - (placeholder)

- **Changed**
  - Preserve partially tagged, registry-unpublished release attempts as
    immutable evidence; only a fresh successor version may reach npm.

- **Fixed**
  - Correct the release-preparation pre-release identity parser and compile its
    embedded JavaScript in workflow policy tests before protected CD.
  - Drain the complete immutable package member stream during protected
    publication verification so `pipefail` cannot mistake tar's SIGPIPE for a
    missing `dist` directory.
  - Pass the downloaded package to npm as an explicit local tarball and recover
    an unpublished release whose immutable tag belongs to an older commit by
    preparing a fresh version instead of rewriting the tag.

- **Security**
  - (placeholder)

## [1.1.0] - 2026-08-13

- **Added**
  - Added discriminated desktop/mobile footer actions, an accessible one-to-five `StarRating`, and a lazy constrained rich-text editor with keyboard formatting, exact schema-compatible limits, and plain-text-only paste (task #39).
  - Export the stable `FOOTER_FEEDBACK_ACTION_ID` used by hosts to identify the
    feedback command without deriving it from labels or routes.
  - (placeholder)

- **Changed**
  - Consume the schema-owned Unicode 15.1 feedback profile through the lazy
    editor model using the registry-only `@plasius/schema ^1.4.0` contract.
  - Refreshed development-only transitive dependencies to versions that close
    the current brace-expansion, nanoid, and undici advisories.
  - (placeholder)

- **Fixed**
  - Preserve block-boundary Enter/caret behavior through an editor-private
    view state without emitting empty AST nodes, keep collapsed Cut
    non-destructive, and close mobile context menus when focus tabs away.
  - Map constrained-editor selections at exact text, span, block, and root
    boundaries; fail clipboard operations closed for invalid or cross-editor
    selections; and keep native Tab focus when removing context menus.
  - Name footer mobile menus, expose their popup relationship, and focus the
    menu surface when every command is disabled.
  - Intercept constrained-editor edits through native `beforeinput`, roll
    escaped post-mutation input back to the canonical model, require a fresh
    mapped selection for every mutation, and keep canonical recovery from
    creating false focus-loss saves or stealing focus.
  - Preserve the active ContextMenu command across equivalent rerenders, move
    focus predictably when commands become unavailable, and name/relate
    Header and UserProfile menus with Escape focus restoration.
  - Keep `ReviewSheet` semantically modal in both side-sheet and phone
    presentations, contain Tab focus, block background pointer/scroll input,
    and restore opener focus for every dismissal path.
  - (placeholder)

- **Security**
  - Prevent checkout-persisted `GITHUB_TOKEN` credentials from overriding the
    narrowly scoped release-preparation GitHub App token used to land release
    metadata through a protected pull request.
  - Replaced token-based npm publication with a two-phase exact-main OIDC workflow, immutable tarball/SBOM hand-off, isolated pull-request validation, and fail-closed integrity checks.
  - The constrained editor emits only an allowlisted transient AST, normalises Unicode, rejects unsupported browser edit/drop operations, and uses no raw HTML injection sink.
  - Disable browser and third-party writing-assistance hooks on the transient
    narrative editor so sensitive text is not intentionally shared with those
    services.
  - Bound hostile rich-text arrays and text before profile or normalisation
    work, and keep the editor's full stylesheet in its lazy implementation
    chunk instead of the initial application shell.
  - Reject lone UTF-16 surrogates and code points assigned after the pinned
    Unicode 15.1 corpus before browser-dependent normalization.
  - Keep publication blocked until the locally validated
    `@plasius/schema 1.4.0` candidate is published and reproduced by a clean
    registry-only install.
  - Fail closed for non-cancelable, empty, unknown, replacement, formatting,
    paste, and drop input escapes without retaining browser-mutated DOM.
  - Keep footer feedback actions entirely outside package analytics so opening
    feedback creates no event, session identifier, transport, or browser
    queue; non-feedback footer actions also emit no package action telemetry.
  - (placeholder)

## [1.0.24] - 2026-08-01

- **Added**
  - Added controlled, accessible `ActionMenu` and `ReviewSheet` primitives with touch-sized controls, responsive popover/sheet presentations, keyboard and focus management, safe-area support, and reduced-motion behavior (task #38).

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - Added fail-closed source and npm-package admission for the administrative contributor registry and pinned the CI/CD runtime to Node.js 24.18.0 LTS.
  - (placeholder)

## [1.0.23] - 2026-07-13

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)
  - Consume the RFC-remediated analytics and translation releases (task #34).

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.22] - 2026-07-11

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed published internal dependencies and compatible stable development dependencies for the next release.
  - Retained TypeScript `^6.0.3` because the current `@typescript-eslint` parser release requires TypeScript `<6.1.0`; TypeScript 7 remains blocked until that peer constraint changes.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.21] - 2026-06-30

- **Added**
  - Added opt-in polished-metal `Header` and `Footer` appearances with active-link support for host shell restyles.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.20] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.19] - 2026-06-22

- **Added**
  - Added `en-GB` shared component translation dictionaries and exported translation keys/helpers for `@plasius/translations`.

- **Changed**
  - Exposed `npm run typecheck` as the canonical TypeScript validation gate and routed audit/workflow checks through the same command.

- **Fixed**
  - Ensured the CD coverage upload generates and locates the lcov report before publishing.
  - Updated the npm publish workflow to use release-prep PRs and release tags instead of direct protected-branch commits.
  - Resolved embedded English defaults in shared UI chrome by routing package-owned display text through `@plasius/translations`.

- **Security**
  - (placeholder)

## [1.0.16] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed dependencies to the latest stable published versions.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.15] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.14] - 2026-04-21

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.13] - 2026-04-02

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.12] - 2026-03-19

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

[Unreleased]: https://github.com/Plasius-LTD/sharedcomponents/compare/v1.1.1...HEAD

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
[1.0.12]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.12
[1.0.13]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.13
[1.0.14]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.14
[1.0.15]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.15
[1.0.16]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.16
[1.0.19]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.19
[1.0.20]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.20
[1.0.21]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.21
[1.0.22]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.22
[1.0.23]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.23
[1.0.24]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.0.24
[1.1.0]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.1.0
[1.1.1]: https://github.com/Plasius-LTD/sharedcomponents/releases/tag/v1.1.1
