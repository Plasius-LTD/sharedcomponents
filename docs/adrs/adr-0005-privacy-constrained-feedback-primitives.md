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

The package is consumed before and after the feedback-domain packages are
released. A runtime dependency on the schema package would couple rendering to
validation and make the base UI boundary less reusable.

## Decision

- Model footer links and commands as a discriminated union. Continue accepting
  legacy link objects while hosts migrate. Render commands as native buttons
  on desktop and disabled-aware commands in the mobile menu.
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
- The package duplicates only the closed feedback AST constants and shape.
  Compatibility tests in the consuming feedback feature must detect future
  schema-version drift before either package is released.
- Publication of this change is blocked until the released
  `@plasius/schema ^1.4.0` Unicode-profile helper replaces the staged
  runtime-dependent unassigned-code-point check. Browser admission must use
  the same pinned profile as the private scanner.
- The host remains responsible for capability/flag evaluation and for loading
  the editor only after narrative is eligible for the active language.
