# ADR-0010: Host-independent persistent workspace

- Status: Accepted
- Date: 2026-11-05
- Work: sharedcomponents#84, site Feature #2385 / Story #2417 / Epic #2382
- Host rollout flag: `arcade.workspace.enabled` (disabled by default)

## Context

The site model viewer already uses a persistent viewport with navigation on the
left and contextual controls on the right. The arcade needs that interaction
without duplicating a second application-specific workspace or resetting a
running game when a panel changes.

## Decision

Publish `PersistentWorkspace` in the existing base UI package. Inject navigation,
labels, option forms and central content. Reuse `ContextMenu`. The host owns
routes, authorization, translated copy, pause semantics and render lifetime.
Keep the centre and hidden forms in stable React positions. Collapse each panel
independently, use contextual actions on desktop rails and separate disclosures
at 1100 CSS pixels or below. Store desktop preferences independently of compact
state. Use labelled nonmodal dialogs for forms, never menu semantics for inputs.

Context Escape/close restores focus; outside interactions preserve the user's
new focus. Clean up media and document listeners. CSS uses existing site tokens
with readable fallback colors and ships in both ESM and CommonJS outputs.

## Consequences and verification

Existing APIs remain unchanged. No UI dependency, game logic, account coupling,
capability evaluation or default-enabled product exposure is added. Hosts must
provide stable child keys and bounded desktop height. Model viewer migration is
a separate site task after this package is released.

Requirements drive tests for state preservation, context-before-action,
independent disclosure/rail controls, focus, native modified links, optional
panels, listener cleanup and axe WCAG 2.2 AA semantics. Real-browser validation
checks layout, 44px targets, focus, scrolling and canvas identity at desktop and
phone widths. Unit checks alone do not certify a host application or a game.
