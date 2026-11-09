# Persistent three-pane workspace

Task #84; site Feature #2385 / Story #2417 / Epic #2382. Host rollout flag:
`arcade.workspace.enabled`. The package does not evaluate access or enable games.

Extract the existing viewer's interaction model into `PersistentWorkspace`:
injected navigation items, translated labels, option sections, actions and a
persistent centre. Reuse the package's `ContextMenu`; no new UI dependency.
Independent desktop panels collapse to rails. A navigation rail first opens a
context menu, then requires the user's explicit open command. Collapsed options
open a nonmodal contextual form. Neither panel changes the viewport's React
identity. Keep hidden option forms mounted and preserve their input state.

At 1100 CSS pixels and below, use independently controlled disclosures. Preserve
desktop collapse preferences across media-query changes. Escape and close restore
focus to the owning trigger. Outside pointer/focus dismisses floating context
without stealing focus from the user's new target. Dispose document/media
listeners. Use distinct IDs for simultaneous workspaces, 44px touch targets,
semantic landmarks, labelled controls, visible focus and independent scrolling.

Tests precede implementation: mounted state and canvas identity through all
collapse/open paths, independent panels, context-before-action, action selection,
focus/Escape/outside close, compact disclosures, viewport resizing, changing
items/selection, missing optional panels, listener cleanup and WCAG 2.2 AA axe
checks. Build/package checks must include new CSS in both module formats. Host
integration additionally requires real-browser small-screen and viewer regression
checks; unit accessibility checks do not qualify the entire arcade.
