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
const footerItems = [
  {
    kind: "link" as const,
    id: "privacy",
    name: "Privacy",
    url: "/privacy",
  },
  {
    kind: "action" as const,
    id: "feedback",
    name: "Rate us or report a bug",
    icon: <FeedbackIcon />,
    onSelect: openFeedback,
  },
];
```

The desktop command is a native 44×44 button. The same item becomes a mobile
menu command. `disabled` is honored in both presentations.

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
feedback flow.

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

Toolbar controls support conventional Mod+B, Mod+I, Mod+U,
Mod+Shift+8, Mod+`[` and Mod+`]` shortcuts. List items also support Tab and
Shift+Tab indentation.

The editor calls `onBlur` only when focus leaves the complete editor surface,
not when a toolbar button receives focus. This lets a host implement dirty-only
focus-loss draft saving.

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

## Accessibility and validation

All interactive controls have 44×44 CSS-pixel targets, visible focus,
light/dark and forced-colour adaptations, semantic radio/toolbar/textbox roles,
non-colour selection cues, and caller-translatable accessible names. Automated
axe, keyboard, interaction, model-limit, and mobile parity tests run with
package coverage.
