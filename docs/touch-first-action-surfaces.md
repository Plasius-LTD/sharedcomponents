# Touch-first action surfaces

`ActionMenu` and `ReviewSheet` are reusable, controlled presentation
components. They intentionally contain no product authorization, route,
mutation, draft, or persistence behavior.

The components inherit the parent Feature rollout key
`admin.workspace.touch-first.enabled`. This package publishes no rollout
evaluator and does not inspect the flag. Consuming applications evaluate their
stored flag and capabilities before rendering the new interaction path. The
rollback path is to render the existing application interaction while leaving
these additive exports installed.

## ActionMenu

`ActionMenu` renders its own 44×44 CSS-pixel minimum trigger. The caller owns
the `open` state and receives requested changes through `onOpenChange`.

Required caller input:

- `label`: accessible name for the menu;
- `triggerLabel`: accessible name for the trigger;
- `trigger`: visual trigger content;
- `items`: stable IDs, visible labels, and selection callbacks;
- `onOpenChange`: controlled-state callback.

Optional item descriptions provide visible supporting text. `tone="danger"`
adds visual emphasis only; it is never an authorization or confirmation
control. Disabled items are skipped by keyboard navigation.

Above `40rem`, the menu is anchored to the trigger, follows viewport scroll and
resize, flips above when necessary, and remains inside a 12-pixel viewport
boundary. At `40rem` and below, it becomes a bottom-aligned, full-width touch
sheet and temporarily prevents background document scrolling.

Keyboard behavior follows menu conventions:

- Arrow Down and Arrow Up open the trigger and move through enabled actions;
- Arrow keys wrap while the menu is open;
- Home and End move to the first and last enabled action;
- Escape and outside pointer input close and return focus to the trigger;
- Tab closes without overriding the browser's next focus target;
- selecting an item runs its callback, closes, and returns focus.

## ReviewSheet

`ReviewSheet` receives caller-owned title, description, body, and footer
content. The caller owns `open` state and handles each
`ReviewSheetCloseReason`:

- `close-button`;
- `escape`;
- `outside`.

The `busy` prop disables all dismissal paths while a caller-owned commit is
pending. `dismissOnEscape` and `dismissOnOutside` may disable individual
dismissal paths. `initialFocusRef` and `returnFocusRef` allow explicit focus
placement for programmatic workflows.

Above `40rem`, the review surface is a non-modal right-side overlay. The
backdrop is visually present but does not consume pointer input. A click on an
exposed application target requests `outside` close and may continue to that
target, allowing the host to implement cancel-and-switch behavior.

At `40rem` and below, the review surface is a full-width phone sheet with
`aria-modal="true"`, background pointer interception, body-scroll locking, and
Tab focus containment. It must close before a background target can be
selected.

Explicit close and Escape restore focus to `returnFocusRef`, or to the element
focused when the sheet opened. Outside close does not force focus back, so a
larger-screen target selection keeps its natural focus.

## Accessibility and styling

Callers must supply localized visible text and accessible labels. The package
provides:

- semantic `button`, `menu`, `menuitem`, and `dialog` roles;
- title and optional description relationships for the review dialog;
- coarse-pointer-friendly 44×44 CSS-pixel targets;
- visible focus indicators and forced-colours support;
- logical scrolling boundaries and iOS safe-area insets;
- disabled animations when `prefers-reduced-motion: reduce` is active.

Theme integration may override the documented `--shared-action-menu-*`,
`--shared-review-sheet-*`, and `--shared-focus-color` custom properties.

## Compatibility

These exports are additive. `ContextMenu`, its coordinate-based positioning,
command contract, close behavior, and public exports are unchanged.
