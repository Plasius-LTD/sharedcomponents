# ADR-0006: Exact-main OIDC package publishing

- Status: Accepted
- Date: 2026-08-01
- Amended: 2026-08-13

## Context

The former `@plasius/sharedcomponents` workflow prepared a release commit and published it from
the workflow run dispatched at the preceding commit. Checking out a newer
commit does not change a GitHub Actions run's source identity, so npm provenance
could identify a different commit from the package and tag. The workflow also
configured a reusable long-lived npm write token.

The feedback programme cannot consume a new package version until publication
has an immutable, independently reviewable identity. The UI package must remain browser-only at runtime; release automation must not acquire feedback narrative or application credentials.

## Decision

Use a two-run release protocol:

1. An operator dispatches `cd.yml` from protected `main` with
   `phase: prepare`.
2. The reusable preparation workflow versions the package with lifecycle
   scripts disabled and lands metadata through a unique, non-force-pushed pull
   request. Its initial checkout never persists the workflow `GITHUB_TOKEN`;
   the narrowly scoped release-preparation GitHub App token is the sole
   credential admitted for the branch push and pull-request mutation.
3. The prepare run waits for successful push-triggered `ci.yml` evidence whose
   branch, event, head SHA, status, and conclusion match the resulting `main`
   commit.
4. If remote `main` still equals that commit, it dispatches
   `phase: publish` from `main`, carrying the exact expected SHA, release tag,
   and version-derived prerelease identity. Workflow policy tests compile the
   embedded parser that derives that identity before the workflow can land.
5. A read-only hosted job repeats exact-main and exact-CI checks, validates and
   packs the package with lifecycle scripts disabled, creates the SBOM, and
   uploads both as digest-bound direct artifacts.
6. The hosted `production` job downloads the exact artifact IDs and verifies
   GitHub and SHA-256 digests, safe tar members, package identity, npm
   distribution tag, and SHA-512 registry integrity. It repeats the exact-main
   check immediately before the first mutation. Archive-member predicates
   consume the complete tar listing so `pipefail` cannot convert a successful
   early match into a false verification failure through SIGPIPE.
7. Only the verified tarball is published through npm OIDC with provenance.
   The privileged job installs no dependencies, runs no project scripts, and
   receives no npm write token.

Preparation runs are serialized. Publication concurrency includes the prepared
SHA so the self-dispatched run is not blocked by its own preparation while
duplicate attempts for the same SHA remain non-cancelling. Conflicting tags are
never rewritten.

The npm trusted publisher must be externally bound to organization
`Plasius-LTD`, repository `sharedcomponents`, workflow `cd.yml`, environment
`production`, and action `npm publish`. GitHub `main` and `production`
policies are independent admission controls. The inherited product flag is `feedback.bug-report.enabled`; the release-governance control is `platform.public-artifact-integrity.enabled` and introduces no runtime exposure. Rollback disables
`cd.yml`; it never restores token publication.

## Consequences

- npm provenance, package bytes, successful CI, tag, and GitHub release bind to
  one immutable `main` commit.
- Dependency and third-party code cannot use the production OIDC or repository
  mutation permissions.
- Checkout-provided credentials cannot shadow the release-preparation App
  token, so an unexpected authentication path fails before release metadata is
  written to the protected branch.
- The embedded JavaScript used to derive the publication distribution tag is
  syntax-checked by the repository test suite rather than first executing in a
  protected release run.
- A moved `main`, mismatched existing package, stale dispatch, or absent
  trusted-publisher binding fails closed.
- Releases use two runs and may require fresh preparation after concurrent
  protected-branch movement.
- CD remains disabled until the trusted publisher and protected environment are
  independently verified.

## Alternatives considered

- Publishing after checking out a child commit in the original run was rejected
  because provenance remains bound to the dispatch commit.
- A token fallback was rejected because it weakens the trusted-publisher
  boundary and makes successful authentication ambiguous.
- One shared concurrency group was rejected because the self-dispatched publish
  run would wait behind the prepare run.
