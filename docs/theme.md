# Scoped theme reference

Import the stylesheet explicitly in the host's themed entry:

```tsx
import "@plasius/sharedcomponents/theme.css";

<section className="plasius-theme" data-theme="light">
  <h1 className="plasius-heading plasius-display">Make something new</h1>
  <p className="plasius-muted">An introduction to the project.</p>
  <a className="plasius-button plasius-button--primary" href="/projects">
    Explore projects
  </a>
</section>
```

The default is a neutral teal palette with sans-serif headings. Add
`plasius-theme--chronicle` to the same container for parchment, moss and gold
with editorial serif headings. Hosts may override the semantic properties
below using their own class on that container. Identity and product decisions
belong to the host; this package contains no brand images or product copy.

## Themes and typography

`data-theme="light"` or `data-theme="dark"` on the scope takes precedence over
an ancestor's dark setting. With no explicit setting, the scope follows an
ancestor's dark setting and otherwise defaults to light. Hosts own OS preference
handling and theme controls; the package does not persist preferences.

Use explicit `data-theme` on each nested or side-by-side specimen so its mode is
unambiguous. The base font is Roboto; the chronicle heading font is Merriweather.
Both include system fallbacks. Hosts self-host and load the necessary fonts;
the CSS contains no remote assets, font faces or imports. Use 400 for editorial
headings and body, 600 for controls and 700 for short labels. Code editors retain
their own monospace font. Wordmark letter spacing is reserved for short names.

The JavaScript entry does not import this theme. Existing components and
unthemed hosts retain their current APIs and styles. Import the CSS once before
host overrides. The export resolves directly to a plain CSS file included in
the published package; it does not depend on a CSS transformation or copy step.

## Semantic properties

| Properties | Purpose |
| --- | --- |
| `--plasius-surface`, `--plasius-panel`, `--plasius-raised` | Page, panel and hover backgrounds |
| `--plasius-text`, `--plasius-muted`, `--plasius-accent` | Primary text, secondary text, links and focus |
| `--plasius-on-accent` | Text on solid accent buttons |
| `--plasius-border` | Visible control and panel borders |
| `--plasius-font-body`, `--plasius-font-heading` | UI/body and headings |
| `--plasius-space-1/2/3/4/6/8/12` | 4/8/12/16/24/32/48px at the default root size |
| `--plasius-radius`, `--plasius-line-height` | Corner radius and body leading |

Header and Footer variable adapters are set on the scope. Layout, fixed versus
flow positioning, imagery, routing and authority remain host-owned.

## Classes and states

All classes require a `.plasius-theme` ancestor.

| Class | Use |
| --- | --- |
| `plasius-heading` | Heading font, colour and leading on a semantic heading |
| `plasius-display`, `plasius-title` | Responsive title sizes; combine with heading |
| `plasius-wordmark`, `plasius-eyebrow` | Short wordmark or section label |
| `plasius-muted` | Secondary text |
| `plasius-link` | Underlined inline link |
| `plasius-button` | Native button or navigation link, minimum 48px tall |
| `plasius-button--primary` | Solid accent modifier |
| `plasius-panel` | Bordered content panel |
| `plasius-label`, `plasius-input` | Associated label and text input/textarea/select |

Use native `disabled` on buttons and form fields. CSS cannot disable a link or
prevent a submit action. Do not use a styled anchor for an unavailable action.
Labels need `for`/`id` (or native nesting); instructions and errors need
`aria-describedby`. `aria-invalid="true"` thickens the border; always also
provide a written error. ARIA does not replace native HTML semantics.

Focus uses an offset 3px outline, including the scope itself. The reduced-motion
rule suppresses animation/transitions inside the scope and forced-colour mode
uses the system highlight for focus. Hosts must avoid clipping outlines.

## Validation and limits

Contract tests check exported asset resolution, opt-in isolation, mode selection,
host overrides, fonts, control states, and text/border contrast in all four base
palettes. Text/accent must contrast at least 4.5:1 with all defined backgrounds;
control borders at least 3:1. Recheck these pairs whenever overriding tokens.

CSS is not executable JavaScript and has no LCOV lines. Existing runtime tests
and coverage still run. Host integration must verify the actual cascade, font
loading, light/dark views, keyboard paths, 320px layouts, zoom, screen readers,
contrast and lazy loading. These contract tests alone do not certify WCAG
conformance or a host's visual result.

Roll back by removing the host's theme scope/import or reverting its version.
Never use styling to grant access or as a substitute for server rollout policy.
