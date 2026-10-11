# ADR-0009: Opt-in theme stylesheet and host identities

- Status: Accepted
- Date: 2026-09-19
- Work: sharedcomponents#71; Story site#2225; Feature site#2185
- Host flag: `site.studio-coming-soon.enabled`
- Host capability: `site.studio-coming-soon.view`

## Context

Hosts need reusable typography, accessible palettes and control treatment while
retaining distinct editorial and education identities. Duplicated page values
drift; applying one brand globally makes unrelated applications inherit it.

## Decision

Publish an explicit `@plasius/sharedcomponents/theme.css` asset. Scope all styling
under `.plasius-theme`, with a neutral default, a chronicle variant and semantic
CSS properties for host overrides. Keep fonts, logos, page composition, product
copy and rollout policy in the host. Importing the JS entry never loads this
stylesheet or fonts. Existing Header/Footer properties receive scoped adapters;
component APIs remain stable. Expose the source CSS directly through package
exports because the existing package allowlist already includes `src`.

The host continues to evaluate stored rollout flags and capabilities using its
existing service. The package neither reads environment flags nor grants product
access. Different identity styles do not imply separate user accounts or consent.
No analytics producer, network sender or new user data is introduced.

## Consequences and validation

Hosts can use shared controls without adopting fantasy branding. They must load
font weights, use semantic HTML and validate any overridden colour pairs. Plain
CSS has no instrumentable LCOV lines; stylesheet contracts and artifact checks
complement existing runtime coverage. Test both palettes/modes, overrides,
scope isolation, focus/disabled states and the exported path. Verify real host
views separately. Remove host imports/scopes or revert the dependency to roll
back, preserving authority and rollout controls.

Publish only through the existing approved CI/CD protocol. Consumers adopt the
verified registry release; no local dependency links enter delivery branches.
