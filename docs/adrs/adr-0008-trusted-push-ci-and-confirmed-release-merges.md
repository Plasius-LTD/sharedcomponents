# ADR-0008: Trusted push CI and confirmed release merges

- Status: Accepted
- Date: 2026-09-08
- Project: sharedcomponents#37, site#1626, Feature site#1597
- Release-governance flag: `platform.public-artifact-integrity.enabled`

## Context

CI used hosted pull-request jobs and ungrouped self-hosted push jobs. The
monthly audit was hosted. These routes did not meet recovery policy. Release
preparation also treated a successful merge CLI request as proof of completion,
although GitHub can accept a request while the PR remains open.

## Decision

Every CI job uses the literal `[self-hosted, Linux, X64]` labels and explicit
`Public CI - Quarantined` group. Only repository-owned pushes trigger CI; no
pull-request or pull_request_target workflow executes checkout code. The
monthly audit uses the same group, a main-only guard, a bounded timeout, and a
clean lockfile install. No hosted fallback or caller-selected runner is allowed.
Existing protected-main check names are preserved.

The group must remain selected and workflow-restricted. Main CI and main-only
audit are admitted. For a reviewed implementation or pipeline-generated release
branch, verify its SHA and workflow, freeze the branch with admin-enforced
protection against pushes/deletion/force-pushes, then admit its exact workflow
ref. Remove temporary admissions after merge. Unrelated group entries are
preserved. Explicit group routing prevents these jobs using the Default group.
A future change needs a new reviewed and frozen branch before admission.

Release preparation always reads PR state after the initial merge command.
Only observed `MERGED` permits continuation. `OPEN` receives bounded protected
merge retries; `CLOSED`, unreadable state, unexpected state, and timeout fail
closed. A retry's successful exit does not substitute for a subsequent state
read. Existing main version/tag and exact-SHA CI checks still apply.

ADR-0006's two-run hosted production OIDC protocol is retained. No dependency
or runtime API changes are required. Existing published @plasius packages and
artifact tooling remain the building blocks. No capability is introduced.

## Alternatives and consequences

Hosted PR validation conflicts with recovery policy. Ungrouped self-hosted
labels can select unintended capacity. Trusting CLI exit status can report
completion prematurely. All three alternatives are rejected.

Operators must admit reviewed frozen branches before required push checks can
run. This is deliberate admission, not a check bypass. Regression tests execute
the actual release shell block with a fake gh executable, covering immediate
merge, queued acceptance, retries, closed/error/unknown state, and deadline.
Workflow policy tests enforce runner, event and publication boundaries.

## Verification and rollback

Run coverage (80% line gate), lint, typecheck, build, package/artifact path
checks, npm audit and actionlint; verify actual CI runner-group identity and
required PR checks. Production publication must prove exact main/CI, hosted
OIDC provenance, tag and registry integrity matching sealed tarball bytes.
There are no changed runtime source files or new browser behavior; existing
component and accessibility tests remain required.

The inherited flag controls promotion, not mandatory integrity checks. To stop
promotion, disable `cd.yml` and remove temporary branch admissions. Never
restore token publication, unsafe runner fallbacks or the removed administrative
path. Record evidence on the Project Task before Done.
