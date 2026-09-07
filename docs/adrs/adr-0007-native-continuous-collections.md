# ADR-0007: Native continuous collection interactions

Status: accepted. Parent Story: Plasius-LTD/plasius-ltd-site#2158;
Feature #2096; package Task #62. Host rollout uses the stored
`admin.workspace.touch-first.enabled` flag and existing route capabilities.

## Decision

Provide `CollectionViewport` as a presentational native scroll region. Load
more is requested only from user scrolling at the bottom or an explicit native
button. Pulling down at the top and releasing beyond 72 CSS pixels invokes the
same read-only refresh callback as the Refresh button. Gesture detection does
not claim nested scroll containers, editable fields, horizontal motion,
cancelled touches or multi-touch input. The browser owns scrolling and scrollbar
geometry, so appended rows and expanded editors automatically affect the thumb.

Hosts own data, cursor merging, stale response rejection, request timeouts,
authorization, rollout, translations and draft policy. The component guards one
operation at a time and aborts callbacks on query reset/unmount. A separate
`useProgressiveItems` hook supports sorted/filtered complete-array endpoints.

Task #66 adds an append-extent guard: a delayed native scroll event cannot repeat
the wheel/touch operation that already loaded that extent, even when its callback
resolved synchronously before the host committed new rows. Explicit fresh input
still works, and leaving the bottom or resetting the query rearms native scroll.
The viewport uses `overflow-anchor: none` so browser layout adjustments cannot
move the view to newly appended content and trigger another load. This uses the
[standard scroll-anchoring opt-out](https://www.w3.org/TR/css-scroll-anchoring/#exclusion-api),
not a timer, fake scrollbar or disabled native scrolling.

## Consequences

Native keyboard scrolling, focus and browser zoom remain available. Explicit
Refresh and Load more controls ensure neither drag nor touch is required.
Refresh can be disabled while a host draft or commit is active. Failure retains
rendered rows and is retryable by another user action; there is no recursive
page-fetch loop or telemetry containing collection data.

Unknown server totals cannot yield an exact whole-dataset scrollbar. The thumb
therefore represents loaded content. Virtualized estimated spacers and custom
scrollbar replacement are excluded because variable-height inline editors and
touch focus must remain stable. Hosts must retain bounded server query/privacy
limits and avoid claiming that a limited report is complete history.

## Verification

Tests cover append/focus retention, short-list wheel and touch behavior,
thresholded refresh, ignored gestures, nested scrolling, drafts/commits,
rejection/retry, query cancellation and keyboard/axe accessibility. Host
integration adds real viewport geometry and endpoint pagination checks.
