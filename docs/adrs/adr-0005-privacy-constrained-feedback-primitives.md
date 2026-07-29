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
  `@plasius/schema` feedback contract `1.0.0`.
- Type-export the AST from the root entry, but expose runtime model helpers
  through the `feedback-rich-text-model` subpath so neither the implementation
  nor the editing model joins the application shell.
- Build editor output from a closed AST: `doc`, paragraph or bullet-list-item
  blocks, and text leaves with only bold, italic, or underline marks. Count
  one newline between blocks toward the exact 4,000 Unicode-code-point limit,
  with a defensive 8,000 UTF-16-code-unit ceiling for browser/scanner payload
  parity.
- Use model operations and React text nodes. Do not use `innerHTML`,
  `dangerouslySetInnerHTML`, `execCommand`, or a general-purpose HTML parser.
  Paste and copy are plain text only; drops and unsupported browser edit
  operations fail closed.
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
- The package duplicates only the closed feedback AST constants and shape.
  Compatibility tests in the consuming feedback feature must detect future
  schema-version drift before either package is released.
- The host remains responsible for capability/flag evaluation and for loading
  the editor only after narrative is eligible for the active language.
