# ADR-0012: Passive semantic interaction markers

- Status: Accepted
- Date: 2026-11-09
- Project: sharedcomponents#31; plasius-ltd-site#1466 under Feature #1464

Shared components receive navigation URLs, labels, account information and
command IDs to render. Those inputs are useful for the UI and must never
become semantic analytics evidence. The host already owns a registered
catalogue and the delegated `@plasius/analytics` observer.

Use opt-in provider context to render a small set of fixed event names from
that catalogue on package-owned native controls. Mark only the control, with
no target ID or payload. Native activation is the shared intent path for
keyboard, pointer, touch and programmatic clicks. Programmatic focus changes,
arrow traversal, passive scroll and raw gesture input are not activations.
Excluded feedback, input values, sensitive commands and host-rendered children
do not receive package markers. Context menus can select only the fixed
navigation class or suppress a command; the caller cannot supply a token.

Do not start the package's legacy tracking from a subtree that opts in. A
second client, synthetic activations, and per-component analytics callbacks
were rejected because they would split session ownership, duplicate events,
or create opportunities to copy display data into evidence. Hosts migrating
to semantic capture keep the legacy metadata switch disabled throughout the
session. Existing hosts that do not opt in retain their legacy behavior.

For the Plasius host, the source of truth remains
`platform.analytics.semantic-journeys.enabled`, composed with the approved
coverage control and visitor consent. Adoption and retirement of the legacy
site path are tracked separately. On withdrawal or rollback the host
removes the markers and disposes capture under its existing consent policy;
it must not restore legacy capture. No capability or local flag override is
added by this package.

Verify the existing delegated observer against real markup, including
synthetic privacy canaries, normal callbacks and excluded actions, and keep
focus and accessibility checks. Release the package through the existing
protected-main workflow. Package release itself installs no host observer
and grants no permission to collect.
