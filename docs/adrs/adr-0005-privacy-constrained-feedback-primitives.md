# ADR-0005: Privacy-Constrained Feedback UI Primitives

- Date: 2026-07-18
- Status: Accepted

## Context

The feedback feature needs the same footer action, one-to-five selection, and
limited rich-text interactions in multiple Plasius applications. The base
package must remain independent of authentication, feature services, storage,
and the feedback backend. Narrative is unusually sensitive: arbitrary HTML,
browser metadata, attachments, links, and pixels must not enter the feedback
contract, and the editor implementation must not enlarge the initial shell.

The root shell must not load feedback validation code. Browser and private
scanner Unicode admission must nevertheless share one pinned data profile;
runtime `\p{Cn}` behavior changes with the JavaScript engine and cannot provide
that consistency.

## Decision

- Model footer links and commands as a discriminated union. Continue accepting
  legacy link objects while hosts migrate. Render commands as native buttons
  on desktop and disabled-aware commands in the mobile menu.
- Keep feedback commands outside package analytics. Export a stable host-owned
  action identity, but create no analytics event, session, transport, or
  browser queue when the feedback surface opens. Treat the prerequisite mobile
  footer-menu toggle as part of that boundary whenever an enabled item has the
  reserved identity, and suppress feedback-identity link telemetry as a
  fail-safe for an incorrectly represented host item. Preserve ordinary menu
  telemetry when a feedback action is disabled and cannot open the surface.
  Capture feedback eligibility at menu-open time; if it becomes enabled during
  an ordinary tracked open, keep the command non-invokable, close the menu,
  restore trigger focus, and require a fresh telemetry-free open.
  Use the captured state for explicit dismissal too, so revocation during an
  open feedback-capable menu cannot introduce a close event.
- Implement ratings with native radio inputs inside an explicitly labelled
  radiogroup. Use caller-owned labels, roving focus, and explicit
  Arrow/Home/End behavior.
- Expose the constrained editor through a `React.lazy` facade. Keep its model
  and TypeScript shape structurally compatible with
  `@plasius/schema` feedback contract `1.0.0`. Keep only a tiny inline loading
  fallback in the facade so the complete editor stylesheet loads with the lazy
  implementation.
- Type-export the AST from the root entry, but expose runtime model helpers
  through the `feedback-rich-text-model` subpath so neither the implementation
  nor the editing model joins the application shell.
- Depend on `@plasius/schema ^1.4.0` and call only its pinned
  `feedback-unicode-profile` helper after applying the 8,000-code-unit input
  bound. Keep that import in the lazy model graph so it does not enlarge the
  root shell.
- Build editor output from a closed AST: `doc`, paragraph or bullet-list-item
  blocks, and text leaves with only bold, italic, or underline marks. Count
  one newline between blocks toward the exact 4,000 Unicode-code-point limit,
  with a defensive 8,000 UTF-16-code-unit ceiling for browser/scanner payload
  parity. Bound raw array visits and source-code-unit inspection to those
  closed limits before Unicode-profile, regular-expression, or normalisation
  work.
- Use model operations and React text nodes. Do not use `innerHTML`,
  `dangerouslySetInnerHTML`, `execCommand`, or a general-purpose HTML parser.
  Paste and copy are plain text only; drops and unsupported browser edit
  operations fail closed.
- Intercept the native DOM `beforeinput` event for cancelable allowlisted edits.
  Treat every `input` event outside a validated live composition as an escaped
  mutation, discard it, and rebuild from the canonical model. Never depend on
  React's synthetic `onBeforeInput` compatibility event for `InputEvent`
  metadata.
- Require a freshly mapped DOM selection for every mutation. Never fall back
  to cached selection offsets when inserting, deleting, pasting, indenting, or
  applying toolbar formatting.
- Preserve the mounted `contenteditable` root during canonical recovery.
  Restore its selection/focus only when it owned focus at the start of
  recovery and focus has not genuinely left the editor surface. Suppress
  recovery-only blur so host focus-loss persistence is not triggered.
- Keep caret-only empty blocks in a private editor view model. Count them
  toward the existing limits, but project through the canonical normaliser
  before every callback so empty blocks and editor-only metadata can never
  cross the host boundary.
- Keep persistence, privacy redaction, encryption, eligibility, feature flags,
  and capabilities in the host. The inherited feedback rollout flags remain
  remotely controlled by the site; this package introduces no local gate.

## Consequences

- Hosts receive reusable, touch-sized WCAG 2.2 AA-oriented primitives without
  pulling service or domain state into the base UI package.
- Feedback opening cannot be correlated through the package's general
  session-bearing analytics client, including through the shared mobile-menu
  opener or an asynchronous eligibility transition during an already-open
  ordinary menu. Unrelated footer links and menus retain their analytics
  behavior. A host that adds surrounding telemetry is responsible for
  preserving the same no-content, no-identifier boundary.
- Narrative remains live browser state controlled by the host. The exported
  extraction helper is explicitly transient and must never be logged, cached,
  persisted, or sent before the host's privacy pipeline.
- Empty formatting blocks are omitted from the AST. Callers can treat `null`
  as no narrative.
- Native input which cannot be canceled is not interpreted after mutation.
  The following `input` notification causes a deterministic rollback and
  constraint signal instead.
- jsdom verifies the model boundary and recovery contract, but it cannot prove
  browser IME ordering. Release remains gated on packaged-artifact checks in
  Chromium, Firefox, and WebKit for composition ordering, post-composition
  input, and focus/blur behavior.
- The package duplicates only the closed feedback AST constants and shape;
  the versioned Unicode corpus remains schema-owned. Compatibility tests in
  the consuming feedback feature must detect future schema-version drift.
- Publication remains blocked until `@plasius/schema 1.4.0` exists in the
  approved registry and clean-install validation proves the registry artifact
  matches the candidate used here. Source, file, workspace, and Git pins are
  prohibited.
- The host remains responsible for capability/flag evaluation and for loading
  the editor only after narrative is eligible for the active language.
