# Design System

The visual language of ghosted.boo, as designed on the canvas in
`.scratch/design-ghosted-boo/` (the `System.dc.html` artboard is the drawn
version of this file). This is the reference for anything built in
`apps/web`, `apps/extension` or `packages/ui`.

The idea underneath it: **silence is the subject**. Status is what the user
sets; silence is what happened to them. The system gives silence its own
scale, its own colour and its own way of fading a card toward the page, and
keeps it visually separate from Status so the two never argue.

## Tokens

All of it comes out of one `@theme` block in
`packages/tailwind-config/shared-styles.css`, which both `apps/web` and
`packages/ui` import — so `StatusBadge` and the web app cannot drift.

### Ground and ink — light

| Token | Value | Use |
| --- | --- | --- |
| `--color-paper` | `oklch(0.972 0.006 285)` | Page ground |
| `--color-paper-raised` | `oklch(0.998 0.002 285)` | Cards, panels, fields, app bar |
| `--color-paper-sunk` | `oklch(0.951 0.008 285)` | Panel headers, table headers, row hover |
| `--color-line` | `oklch(0.905 0.008 285)` | Default borders, dividers |
| `--color-line-strong` | `oklch(0.858 0.010 285)` | Control borders, column rules |
| `--color-ink` | `oklch(0.215 0.022 285)` | Primary text, primary button fill |
| `--color-ink-muted` | `oklch(0.420 0.018 285)` | Secondary text, body prose |
| `--color-ink-faint` | `oklch(0.530 0.014 285)` | Meta, placeholders, disabled labels |

Every neutral carries the same **285° hue** at very low chroma, so the greys
read as a cool bone-white paper rather than as switched-off colour.

**Never use `opacity` to dim text.** It double-dims over a tinted background
and cannot be tuned per surface — that is why the current badges and failure
banner look muddier than they should. Use `ink-muted` / `ink-faint`.

### Accents — one brand hue, three semantics

| Token | Value | Carries |
| --- | --- | --- |
| `--color-spectre` | `oklch(0.520 0.120 298)` | Brand, Applied, links, focus ring |
| `--color-ember` | `oklch(0.520 0.120 62)` | Interviewing, going cold, partial Coverage |
| `--color-vital` | `oklch(0.520 0.120 152)` | Offer, Coverage you have |
| `--color-rose` | `oklch(0.520 0.120 18)` | Rejected, missing Coverage, closing date, destructive, Excitement |

Each has a `-tint` companion used as a fill behind it:
`--color-spectre-tint` `oklch(0.945 0.032 298)`,
`--color-ember-tint` `oklch(0.951 0.036 68)`,
`--color-vital-tint` `oklch(0.949 0.036 155)`,
`--color-rose-tint` `oklch(0.953 0.030 20)`.

All four accents sit at **L 0.52 / C 0.12** and differ only in hue, so a green
badge and a red badge carry exactly the same visual weight and no Status can
win an argument by being brighter.

**0.12 is the ceiling, not a preference.** It is the most these four hues can
hold at that lightness and stay inside sRGB. Push it and the browser silently
clips ember and vital, shifting their hue.

### Dark

The same table with paper and ink swapped and the accents lifted to
**L 0.735 / C 0.145** — same four hues, so no component has to know which
theme it is in.

```
--paper 0.183 0.018 288   --paper-raised 0.228 0.020 288  --paper-sunk 0.268 0.020 288
--ink   0.958 0.005 288   --ink-muted    0.755 0.014 288  --ink-faint  0.620 0.016 288
--line  0.318 0.018 288   --line-strong  0.382 0.020 288
spectre/ember/vital/rose  oklch(0.735 0.145 <hue>)
tints                     spectre 0.315 0.058 298 · ember 0.300 0.052 62
                          vital   0.292 0.052 152 · rose  0.308 0.058 18
```

The values are stated once, as `--night-*`, and mapped twice: onto `:root`
under `prefers-color-scheme: dark`, and onto **`.night`** — a surface that is
dark whichever theme the reader is in. There is one of those, the statement
beside the sign-in form. It restates the table locally rather than being
written in fixed colours, so everything inside goes on using the app's own
names: `text-ink-muted` inside a `.night` is the dark theme's muted ink, and no
component has to know where it is standing.

### The `@theme` block

```css
/* packages/tailwind-config/shared-styles.css — replaces the three orphan
   --color-*-1000 values left over from the create-turbo starter */
@import "tailwindcss";

@theme {
  --color-paper:        oklch(0.972 0.006 285);
  --color-paper-raised: oklch(0.998 0.002 285);
  --color-paper-sunk:   oklch(0.951 0.008 285);
  --color-line:         oklch(0.905 0.008 285);
  --color-line-strong:  oklch(0.858 0.010 285);
  --color-ink:          oklch(0.215 0.022 285);
  --color-ink-muted:    oklch(0.420 0.018 285);
  --color-ink-faint:    oklch(0.530 0.014 285);

  --color-spectre:      oklch(0.520 0.120 298);   /* brand · Applied */
  --color-spectre-tint: oklch(0.945 0.032 298);
  --color-ember:        oklch(0.520 0.120 62);    /* Interviewing · going cold */
  --color-ember-tint:   oklch(0.951 0.036 68);
  --color-vital:        oklch(0.520 0.120 152);   /* Offer · have it */
  --color-vital-tint:   oklch(0.949 0.036 155);
  --color-rose:         oklch(0.520 0.120 18);    /* Rejected · missing */
  --color-rose-tint:    oklch(0.953 0.030 20);

  --font-display: "Instrument Serif", "Iowan Old Style", Georgia, serif;
  --radius-tag: 4px;  --radius-control: 5px;
  --radius-card: 9px; --radius-panel: 11px;
}
```

The starter body gradient in `apps/web/app/globals.css` goes with it.

## Type

Two faces: a high-contrast serif for numbers and headlines, a plain grotesque
for everything you actually read.

| Role | Face | Size / leading |
| --- | --- | --- |
| Display | Instrument Serif 400 | 48 / 1.02, tracking −0.015em |
| Statement (the tally) | Instrument Serif 400 | 37 / 1.12, tracking −0.012em |
| Section (empty states) | Instrument Serif 400 | 26 / 1.15 |
| Title | Public Sans 600 | 14 / 1.3 |
| Body | Public Sans 400 | 13.5 / 1.55 |
| Meta | Public Sans 400 | 12 / 1.4, `ink-faint` |
| Eyebrow | Public Sans 600 | 10.5, caps, tracking 0.09em |

- **Instrument Serif has one weight.** Never let a browser synthesise bold on
  it — headline emphasis comes from colour and size, never a heavier cut.
- Public Sans is the workhorse and is metric-compatible enough with the
  **Geist** already installed in `apps/web/app/layout.tsx` that Geist can stay
  for UI if you would rather ship only the one new font.
- `font-variant-numeric: tabular-nums` on `body`, everywhere. Counts must not
  shuffle as they change.

## Metrics

- **Spacing** on a 4px base: 4, 8, 12, 16, 22, 34, 48, 64. Card padding 12,
  panel padding 18, page gutter 64, section gap 20–34.
- **Radii**: 4 tag · 5 control · 9 card · 11 panel · 999 pill. Tighter than
  the `rounded-md` used today.
- **Controls** are 34px tall, 28px small, 40–42px on the sign-in page. Every
  hit target on a phone stays at 44px.
- **Focus** is `border-color: spectre` plus `box-shadow: 0 0 0 3px spectre-tint`
  on fields, and `outline: 2px solid spectre; outline-offset: 2px` on cards
  and icon buttons. Never remove it.

## Components

### Status pill

Round (999), 20–23px tall, 10.5–11px 600. Tint fill, accent text. One per
Status, and the pill is the only thing that carries Status colour.

| Status | Fill / text |
| --- | --- |
| Bookmarked | `paper-sunk` / `ink-muted` |
| Applied | `spectre-tint` / `spectre` |
| Interviewing | `ember-tint` / `ember` |
| Offer | `vital-tint` / `vital` |
| Rejected | `rose-tint` / `rose` |
| Withdrawn | transparent, 1px `line-strong` inset ring / `ink-faint` |

### Silence tag

Rectangular (radius 4), 19–23px tall, bordered. Deliberately a different
shape from the Status pill so the two axes never read as one.

| Reading | Days | Treatment |
| --- | --- | --- |
| Fresh | 0–7 | no tag at all |
| Quiet | 8–20 | `line-strong` border, `ink-muted` text |
| Going cold | 21–44 | `ember` border, `ember-tint` fill, `ember` text |
| Ghosted | 45+ | dashed `ink-faint` border, `ink-muted` text |
| Closes in Nd | — | `rose` border, `rose-tint` fill, `rose` text |

Silence is counted from the last thing that actually happened, and applies
only where the user is waiting on somebody — an Applied or Interviewing Job
Application. A Bookmarked one has nobody to hear from; an Offer, a Rejection
or a Withdrawal has already been answered. A closing date takes the tag slot
when there is no silence to report.

### Card

`paper-raised`, 1px `line`, radius 9, padding 11/12/12. Company 13.5/600, job
title 12/400 `ink-muted`, the salary in its short form in the same 12/400
`ink-muted`, then a `marks` row holding the Coverage dial and the one tag. A
card with no salary recorded has no salary line rather than a dash.

The card fades toward the page as silence grows — **it never turns red.
Ghosting is an absence, not an error.**

- `going cold` — dashed `ember` border
- `ghosted` — dashed `line-strong` border, transparent background, company
  drops to `ink-muted`, title to `ink-faint`, and the ghost mark bleeds out of
  the bottom-right corner at 5% `ink`

### Coverage

Three readings, bordered like the silence tag but 24px and 11.5/600:
`Have it` (vital), `Partly` (ember), `Missing` (rose). A trailing `· analysed`
or `· yours` in 10.5/400 at 75% names the basis when it is not the plain
comparison — see `docs/adr/0004-coverage-has-three-readings-and-two-bases.md`.

The card and table use a compact form of the same thing: a 15px donut
(4px stroke, `line-strong` track) plus `n/m`, coloured `vital` at ≥0.8,
`ember` at ≥0.5, `rose` below.

### Fit banner

The board's ring, on the page that has room for it: the fraction in the display
face at 42px, the sentence beside it, and one 6px bar per required Requirement
— `vital`, `ember`, faint `rose`, `line-strong` for unread. The sentence
carries the whole reading; the meter is reinforcement under it. Both are absent
in exactly the cases the ring is, so a card that draws no ring never sits under
a page claiming a fit.

### AI Usage meter

The Profile's last panel, and the only place the product says anything about
cost: the share spent in the display face at 42px, the sentence beside it in
13/400 `ink-muted`, and one 6px bar under it on a `line-strong` track. The
sentence carries the whole reading — what was spent, of what, in tokens — and
the bar is `aria-hidden`, exactly as the fit banner's is.

The fill is `spectre`, and `ember` once the month is spent. Spectre because
spending is neither good news nor bad and the brand hue is the one accent that
carries no verdict — the same use the tally makes of it for the quiet number.
Ember rather than rose because a month that ran out is an ordinary end: rose is
what this system says errors, destruction and a missed closing date in, and a
meter that turned red would read as a fault the user had committed.

The figure is rounded up and stops at 99% while any of the month is left, so
that it never says a month is over while a Conversation would still answer. It
goes above 100 where a call admitted inside the limit overshot it
(ADR-0009); the bar stops at its own end and the figure does not.

The daily Model Call count is nowhere on it, and there is nowhere in this
system for it to be.

### Silence thread

The right column's first panel on a Job Application: what has happened, in
order, ending in where it stands today. A dot and a rule per beat, the dot on
the last one `ember` in a 3px `ember-tint` ring. A **gap** — a silence that has
run on — breaks its rule into a dashed one and sets its words in the display
face, italic, in `ember`. It is made only of what the record holds; there is no
event log behind it.

### Excitement

Nought to five, in hearts — not stars, which is the rating control from every
other website, and no longer flames: a flame is an outline shape, and filling
one read as a blot rather than as a rating. A heart is solid to begin with, so
three of five reads as three of five at 13px as well as at 22px. 36px targets,
`line-strong` unlit and `rose` lit, filled only when lit. The rating is said in
words beside the row: *Not fussed. · Worth a punt. · Mildly keen. · Would be
pleased. · Really want this one.*

It saves on the press rather than on the page's Save button — it is a
judgement rather than a correction, and there is nothing about it to get
wrong. The Coverage override is the only other control on that page that does.

The table draws the same five hearts at 13px, unpressable, with a dash where
nobody has rated it. All five are always drawn, as the fit ring always draws
its whole track: two hearts and five hearts are the same picture at different
lengths, and nothing would say what the rating is out of.

### Salary

A salary on the dashboard is its Salary Equivalent in a short form, restated
over the Salary Period the toolbar reads salaries in: `≈ 17–26.1k PLN / mo`.
Thousands take a `k` from 10 000 up; the periods shorten to `yr`, `mo`, `day`,
`h`. The `≈` is drawn only where the figure was restated, and it carries the
hover text — the salary as the Posting stated it, and the working year it was
restated on. The same sentence is in the page for a screen reader. The table
cell is the row's plain 13/400 ink, with the `ink-faint` dash Location uses
where none is recorded. The detail view and the side panel show the salary as
stated.

### Buttons

| Variant | Treatment |
| --- | --- |
| Primary | `ink` fill, `paper-raised` text; hover fills `spectre` |
| Quiet | `paper-raised` fill, `ink-muted` text, `line-strong` border; hover to `ink` / `ink-faint` |
| Danger | transparent, `rose` text and border |
| Disabled | opacity 0.42, `not-allowed` |

Primary hovering to the brand hue is the one place colour is used as a
reward. There is no filled-accent button anywhere in the system.

### Fields

34px, radius 5, `line-strong` border, `paper-raised` (or `paper` inside a
raised panel). Labels are 11px 600 caps `ink-faint` above the control. An
invalid field takes a `rose` border and ring and a `rose` message below it in
12/400 — the message says what to do, not that something is wrong.

Selects draw their own caret from two CSS gradients; no icon font, no SVG.

### Icons

24px grid, 1.7px stroke, round caps and joins, `currentColor`, no fills —
the ghost's eyes and the Excitement heart are the two exceptions. An unlit
heart scales its stroke against its size, so the outline weighs the same in a
table cell as in the control. **Never emoji.**

The ghost mark is the wordmark's own glyph reused at three sizes: 21px in the
bar, 34px dashed in empty states, 86px at 5% opacity bleeding off a ghosted
card.

## Layout

- **App bar**: 60px, `paper-raised`, 1px `line` bottom, 64px gutters.
  Wordmark left (`ghosted` in `ink`, `.boo` in `ink-faint`), Your Profile /
  Track a job / avatar right.
- **Board page**: tally → toolbar → count line → board. The toolbar is the
  search, the Status filter and the silence control on the left. On the
  right, a native "Sort: …" select at 220px (with the board only), then the
  Salary Period (Year / Month / Day / Hour, starting on Month) and the view,
  both segmented controls. All three are remembered in browser storage, and
  the sort is the same one the table's headings set. Six columns, `minmax(0,1fr)`, 14px gap, 8px between cards. Column head is an
  eyebrow plus a count over a 1.5px `line-strong` rule; terminal columns
  (Rejected, Withdrawn) drop their head to `ink-faint`.
- **The tally** is the statement serif and the app's only piece of first-person
  arithmetic: *"14 tracked. 6 still in the air. 3 have gone quiet on you."*
  The quiet number is `spectre`; the words around the numbers are `ink-faint`.
- **Table view** is the same data, unstyled prose weight, with a Salary
  column after Location, in a radius-10 wrap with a `paper-sunk` header.
  Every heading is a button that sorts: the sorted one in `ink` with an 11px
  arrow for its direction, the rest `ink-faint` with a faint two-way arrow
  drawn only on hover and focus, so a table at rest does not read as a row of
  arrows. The whole heading cell is the button's target. It exists because six columns stop working around fifty Job Applications.
- **Job Application page**: two columns, `minmax(0,1fr) 396px`.
  Left is what you came to read — the fit banner, Requirements and Coverage,
  the Posting text and your notes. Right is the record and the machinery — the
  silence thread, the Analysis panel, then the 14 fields. The fields did not
  get fewer; they stopped being the first thing you see.
- **Sign-in** is two halves — the statement and the door — at
  `minmax(0,1.18fr) minmax(0,1fr)`, folding to one column on a phone. The
  statement is the app's only `.night` surface: the mark at 25px, a 57px serif
  line with its second sentence in `spectre` italic, and three numbers over a
  `line` rule. Every one of those numbers is read off the constant it
  describes. Controls here are 40px and the button 42.
- **Side panel** is 400px of the same system at one step down: 48px bar,
  14px padding, 32px fields, 12.5px body. A field the extension read off the
  Posting carries a 2.5px `spectre` left border, so what was read is
  distinguishable from what was typed.

## Voice

Dry, never chirpy — and it stops being funny the moment the user has a
problem to solve.

**The wit lives in** empty states, silence labels and the tally:

> *Nothing out there yet.* — Track your first job and the board fills itself in.
>
> *No sign of it.* — No Job Application at that Status carries what you
> searched for. The filters are doing more work than you meant them to.
>
> *Nobody is ignoring you.* — Every job you are waiting on has been heard from
> in the last week. Enjoy it — this is not the usual state of affairs.

**Nowhere near** errors, destructive confirmations, or anything about money or
data. Those say plainly what happened, what state things are in now, and what
to press:

> *Could not load the latest Job Applications.* — The board below is the last
> good copy, from four minutes ago. Anything you change now may not save.
> [Try again] [Dismiss]

Other standing rules:

- Use the domain words from `CONTEXT.md` in the UI, capitalised as it
  capitalises them: Posting, Job Application, Status, Profile, Requirement,
  Coverage, Analysis.
- Never imply the user is owed a reply. "Nobody owes you a reply — but it
  helps to know who is not sending one."
- The app speaks first at most once a week, in the nudge above the board, and
  it only ever offers to take the user somewhere. **It never sets a Status on
  their behalf** — Status is set by the user and never inferred.

## States

- **Loading** is a skeleton (`line` fill, 1.8s opacity pulse 1 → 0.45) *plus*
  a written line — "Loading your Job Applications…" — because a skeleton is
  furniture to a screen reader.
- **Failure** is a `rose` border on `rose-tint` with a 13.5/600 `rose` heading,
  the plain explanation in `ink-muted`, and two buttons.
- **Empty** is a dashed `line-strong` frame, the dashed ghost, a serif line at
  26px, one sentence of `ink-muted` body and at most two quiet buttons.
- The count line under the toolbar is `aria-live="polite"`.

## Accessibility

- Each accent reads at **4.5:1 or better on its own tint**.
- **Colour is never the only carrier.** Every badge says its reading in words
  as well — "Going cold · 34d", not an amber dot.
- Silence carries three signals at once: the tag's words, the tag's colour,
  and the card's fade. Any one of them alone is enough to sort by.
- Every card and row is a real link or button, focusable, with a visible
  focus ring; drag-to-move on the board is an enhancement over a Status
  select, never the only way to change a Status.

## The printable version

`docs/design-system.pdf` (A4) and `docs/design-system.png` (one tall sheet)
are rendered from `.scratch/design-ghosted-boo/design-system.print.html` —
a specimen version of this document, built out of the system's own tokens.
**This markdown file is the one to edit**; the print source and its two
outputs are regenerated from it by hand.

To re-render (Chrome, no dependencies — `fonts-inline.css` holds the two
webfaces as base64 so the PDF needs no network):

```bash
cd .scratch/design-ghosted-boo
python3 -c 'open("/tmp/ds.html","w").write(open("design-system.print.html").read().replace("/*FONTS*/", open("fonts-inline.css").read(), 1))'
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=../../docs/design-system.pdf file:///tmp/ds.html
"$CH" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=820,5460 --screenshot=../../docs/design-system.png file:///tmp/ds.html
```

The `--window-size` height is the document's own `scrollHeight`; if the
document grows, raise it or the screenshot is cropped to the viewport.
