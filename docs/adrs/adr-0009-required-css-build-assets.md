# ADR-0009: Required CSS build assets

- Status: Accepted
- Date: 2026-10-23
- Project: sharedcomponents#22, organisation Project #1 item 203175456

## Context

Both package formats import component CSS modules. The shell copy previously
masked rsync failures; package admission checked CommonJS metadata and private
paths but did not require packed stylesheets. Successful TypeScript compilation
could therefore produce an incomplete public artifact.

## Decision

Use a small repository-local Node.js helper to validate the eleven current
component stylesheets, enumerate all source CSS modules, and copy them to the
matching relative paths in both output trees. Only `dist` and `dist-cjs` are
accepted destinations. Source symlinks and nonregular required files are rejected,
and filesystem errors propagate to the build. The required list makes deletion
fail even when old output remains; future component changes must update the list
and fixtures. New additional modules are discovered and validated automatically.

Package validation shares the asset enumeration and requires each stylesheet in
the actual npm dry-run file manifest for both formats. Existing CommonJS and
private-path/reference checks remain mandatory. The verifier accepts an explicit
fixture root, uses argument-array subprocess execution with a timeout, and throws
on failure so direct tests can exercise it without terminating the test runner.
Its CLI retains nonzero failure behavior.

CI runs build then pack validation. CD already runs both in its read-only
validation job before sealing the tarball; ADR-0006's main/production hosted OIDC
publication and ADR-0008's trusted push admission remain in force. This is the
issue's repository-operational maintenance exception: no product Feature,
capability, or remote flag applies to these mandatory build integrity checks.

Existing @plasius packages supply runtime components and services. None supplies
this repository's source asset layout/build check; Node built-ins fit without a
new runtime dependency, public helper, package, or runtime API. Dev-only
`@types/node` 24.19.2 supplies the missing typings for build/release tests, which
are checked by the standard typecheck command; its transitive `undici-types`
dependency is declarations only. Component code, CSS bytes,
runtime dependency versions, and export contracts do not change.

## Alternatives and consequences

Retaining rsync without failure masking would retain an unnecessary platform
tool dependency. Checking only disk files would miss npm file-list exclusions.
Globbing only existing source files would miss deleted required stylesheets.
These alternatives do not provide the complete build contract.

Tests run the real npm scripts in isolated fixtures with a controlled compiler,
prove missing-source/copy/compiler failure propagation, and reject every absent
packed stylesheet plus manifest omissions. Direct helper tests cover nested
assets, idempotence, invalid paths, symlinks, and retained package guards. Both
changed helpers must appear in combined LCOV and total line coverage stays >=80%.
Run unit/component/accessibility tests, lint, typecheck, build, pack/artifact
checks, dependency audit/signatures, actionlint, and packed/public ESM/CJS consumer
bundles before recording exact-source CI/CD and registry provenance evidence.

## Release and rollback

Publish a new patch only through approved `cd.yml` on main/production. Verify
successful exact-main CI, immutable tarball integrity, tag, npm provenance, and
all eleven CSS files in both public formats. Backend secretref is N/A for this
npm-only change. Stop promotion by disabling CD when necessary; any corrective
release uses the same protected workflow and retains mandatory integrity gates.
