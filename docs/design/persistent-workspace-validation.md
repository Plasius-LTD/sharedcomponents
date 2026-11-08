# Persistent workspace validation

Task sharedcomponents#84; site Feature #2385. Recorded 5 November 2026.

## Requirements and regression evidence

The initial nine requirement tests failed before the component was exported.
The mobile disclosure label regression then failed before explicit accessible
names were added. Ten workspace tests now cover state/canvas preservation,
independent panels, context-before-action, native modified links, focus/Escape,
outside dismissal, compact resizing, optional/changed panels, listener cleanup
and automated WCAG 2.2 AA semantics.

Full suite: 239 tests in 24 files pass. Combined coverage is 92.97% lines,
85% branches and 97.36% functions. The new component has 60/60 executable lines,
40/40 functions and 120/129 branches covered. Both changed source barrels, the
component and its stylesheet appear in LCOV. Build fixtures now require the
new CSS in ESM and CommonJS outputs; removing either copy fails validation.

Node 24.18.0: typecheck, lint, build, package inventory/CSS checks and full npm
audit passed. Full audit reported zero vulnerabilities at verification time.
The dependency review retained the existing released Plasius UI/schema/analytics/
translation packages. No UI framework was added. Only the development minimatch
override/lock entries changed to patched 11.0.1, addressing
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Browser evidence and limits

Playwright Chromium used a local verification fixture with 24 navigation items,
forms and an explicitly labelled non-game canvas. At 1440x900, 390x844 and
320x568, no horizontal page overflow occurred. Independent disclosures/rails,
form controls, context menus and independent navigation scrolling were inspected.
Escape returned focus to Games or Settings as appropriate. Canvas identity stayed
unchanged through panel operations and viewport changes. Visible controls met
44px targets in settled layouts; the inherited context-menu animation is measured
after it finishes. Screenshots were inspected; they remain local test artifacts.

This validates the package workspace only. Host model-viewer regression,
physical touch devices, screen-reader testing, GPU gameplay performance and
game-duration qualification remain separate site/game delivery gates. CI and
approved package publication evidence must be recorded on Task #84 before Done.
