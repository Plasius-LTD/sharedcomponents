# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

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

[Unreleased]: https://github.com/Plasius-LTD/sharedcomponents/compare/main...HEAD

## [1.0.0] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
