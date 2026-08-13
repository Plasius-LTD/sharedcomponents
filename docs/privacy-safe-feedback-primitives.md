# Privacy-Safe Feedback Primitives

## Scope

`@plasius/sharedcomponents` provides presentation and browser-memory editing
only. It does not decide whether feedback is available, identify a reporter,
save drafts, encrypt narrative, call an API, or store a review.

Hosts must gate the feature with the remotely evaluated feedback flags and
capabilities before rendering any action or form. Removing an action from
`Footer.items` removes it from both desktop and mobile output.

## Footer actions

Use a discriminated item when the footer entry invokes behavior:

```tsx
import { FOOTER_FEEDBACK_ACTION_ID } from "@plasius/sharedcomponents";

const footerItems = [
  {
    kind: "link" as const,
    id: "privacy",
    name: "Privacy",
    url: "/privacy",
  },
  {
    kind: "action" as const,
    id: FOOTER_FEEDBACK_ACTION_ID,
    name: "Rate us or report a bug",
    icon: <FeedbackIcon />,
    onSelect: openFeedback,
  },
];
```

The desktop command is a native 44×44 button. The same item becomes a mobile
menu command. `disabled` is honored in both presentations. Hosts import the
stable `FOOTER_FEEDBACK_ACTION_ID` constant rather than constructing an
analytics-bearing identifier from a label, route, or content.

Footer action telemetry is closed rather than caller-shaped. Only the exact
`FOOTER_FEEDBACK_ACTION_ID` value emits the fixed `feedback_open` event with a bounded
desktop/mobile variant. The event uses an isolated analytics client with no
label, URL, host route/context, organization, website, or automatically
injected channel context. Other action IDs emit no package telemetry. Hosts
must keep feedback form state and content out of their `onSelect` telemetry.

## Star ratings

`StarRating` is controlled and accepts exactly five caller-translated labels.
It uses native radios for form and screen-reader semantics, while its visible
state combines filled/empty shapes, a selected border, and a textual
`x / 5 — label` result so selection does not depend on colour.

Arrow keys wrap, Home selects one, and End selects five. A read-only group
remains focusable and cannot mutate.

## Constrained rich text

`ConstrainedRichTextEditor` is dynamically imported through `React.lazy`.
Hosts supply all visible and accessible labels.

The root package entry type-exports the AST, but does not runtime-import its
editing model. Hosts that need transient model helpers must import
`@plasius/sharedcomponents/feedback-rich-text-model` from within their lazy
feedback flow. The facade uses only a tiny inline loading fallback; the model,
editing state, and complete editor stylesheet load with the implementation.

The emitted transient AST permits:

- paragraphs;
- bullet-list items;
- depths zero through four;
- bold, italic, and underline marks;
- up to 128 blocks and 256 text leaves;
- up to 4,000 extracted Unicode code points, including one newline between
  blocks, and never more than 8,000 UTF-16 code units.

The component normalises text to Unicode NFKC, removes control/format
characters, inserts clipboard content as `text/plain`, and blocks drops,
HTML/link syntax, browser link commands, arbitrary formatting, and unsupported
edit operations. It never uses an HTML injection sink.

The implementation intercepts the browser's native `beforeinput` event rather
than React's synthetic compatibility event. Only cancelable, allowlisted edit
types are projected through the model. Any `input` event which reaches the
component outside a validated live composition is treated as an escaped native
mutation: the DOM is rebuilt from the canonical model, no change is emitted,
and the unsupported-content callback is raised. This includes empty or unknown
input types, replacement text, formatting, paste, drop, and non-cancelable
browser edits.

Every model mutation captures and maps the current browser selection at the
point of use. Insert, delete, paste, list indentation, and toolbar actions abort
and rebuild the canonical DOM when that selection is stale, outside the
editor, crosses another editor, splits a surrogate pair, or touches an
unrecognised node. A previously valid range is never used as a mutation
fallback.

The model visits at most 128 input blocks and 256 input leaves and inspects at
most 8,000 source UTF-16 code units before applying the pinned Unicode-profile
checks or NFKC normalisation. Oversized browser input is therefore truncated at
the same closed AST/text envelope without allowing attacker-sized pre-validation
work.

Toolbar controls support conventional Mod+B, Mod+I, Mod+U,
Mod+Shift+8, Mod+`[` and Mod+`]` shortcuts. List items also support Tab and
Shift+Tab indentation.

The editor calls `onBlur` only when focus leaves the complete editor surface,
not when a toolbar button receives focus. This lets a host implement dirty-only
focus-loss draft saving. Canonical recovery preserves the mounted
`contenteditable` root and replaces only its model-owned children. Selection
and focus are restored only when the editor held focus at recovery and no
genuine focus exit occurred; internal recovery never creates a focus-loss
save, and recovery never takes focus back from another control.

Enter may create an empty paragraph or list item so the browser can place the
caret at a block boundary. That block exists only in the editor's private live
view state, counts toward the character/block ceilings, and is discarded on
unmount. It is never passed to `onChange`; the callback receives a canonical
AST only after the block contains text. An equivalent controlled-value echo
does not collapse the live caret block, while a genuinely different value
replaces it.

## Privacy boundary

`FeedbackRichTextDocument` is transient sensitive data even though its
structure is allowlisted. The host must:

1. keep the document in live browser memory only;
2. perform deterministic redaction and show removals to the user;
3. validate with the matching `@plasius/schema` contract;
4. encrypt the AST for transient analysis;
5. discard the document and extracted text on close or reload;
6. never log, cache, persist, analyse, or attach the document to telemetry.

`extractFeedbackRichText` exists only for the privacy/redaction pipeline. Its
return value must not cross that boundary in readable form.

## Schema 1.4 publication gate

The release candidate declares registry-only `@plasius/schema: ^1.4.0`, imports
`containsFeedbackUnicodeProfileUnsupportedText`, retains the pre-scan 8,000
UTF-16-code-unit bound, and covers lone surrogates plus post-15.1 assignments.
It has been exercised against an exact local schema candidate without adding a
file, workspace, source, or Git dependency.

Do not publish these feedback primitives until `@plasius/schema` 1.4.0 is
available from the approved public registry. Once it is available, release
preparation must:

1. regenerate and verify `package-lock.json` from the registry, never from a
   file or Git source, and confirm the published integrity matches the expected
   candidate artifact;
2. repeat type, lint, coverage, build, dependency, packed-artifact, and lazy
   bundle admission with the registry-resolved lockfile.

The schema import belongs only to the feedback model/lazy editor path. The
root entry must continue to type-export the AST without loading the Unicode
profile into the initial application shell.

## Real-browser release gate

This package currently has no Playwright or other real-browser test project, so
the jsdom suite is not evidence of browser IME interoperability. Before
release, the consuming application's existing browser E2E gate must exercise
the packaged artifact in current Chromium, Firefox, and WebKit and verify:

- standard composition commit, cancellation, explicit deletion, invalid
  Unicode, character-limit rejection, marked cross-span input, and DOM drift;
- Firefox's additional post-`compositionend` composition input and the legacy
  `insertFromComposition` form without duplicate output;
- dead keys, mobile/virtual keyboard replacement input, and dictation where the
  automation platform supports them;
- zero host `onBlur` calls for internal commit/cancel/rejection recovery;
- exactly one host `onBlur` call for a genuine focus exit, with no subsequent
  editor refocus; and
- canonical rollback for non-cancelable, empty, unknown, paste, drop,
  replacement, and formatting `input` events.

This remains an explicit unrun release gate in this repository until owned
real-browser infrastructure is added.

## Accessibility and validation

All interactive controls have 44×44 CSS-pixel targets, visible focus,
light/dark and forced-colour adaptations, semantic radio/toolbar/textbox roles,
non-colour selection cues, and caller-translatable accessible names. Automated
axe, keyboard, interaction, model-limit, and mobile parity tests run with
package coverage.
