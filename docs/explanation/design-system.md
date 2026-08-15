# Explanation: the pixel design system

The portal is dressed as an 8-bit game. This explains what that means in
practice, why it is built the way it is, and — more usefully — the one rule
that keeps it from getting in the way of the work.

## Decoration may play, records may not

This is the line everything else follows.

A label naming a **screen** is decoration. Someone who cannot find "Requests"
because it says "Quests" finds it one click later, and the fantasy naming is
therefore allowed to rename screens (`app.branding.flavour`), off by default.

A label naming a **state** is a record. `SUCCEEDED` and `FAILED` are what the
badge, the list, the API and the audit trail all say, and they never change.
`LEVEL UP` and `GAME OVER` play over the top of a finished request for about
two seconds and then disappear; the badge underneath them is unchanged
throughout. Nobody should find the words "GAME OVER" in a support thread about
a failed provision.

The same rule excludes the rest of the genre: no XP, points, streaks or
leaderboards. This app approves production changes, and turning approvals into
a score changes what people optimise for.

## How it is built

**One stylesheet, injected.** `plugins/platform-ui/src/styles.ts` is a single
CSS string with the tokens, the `.sc-*` component classes, and a reskin of the
MUI and canon components Backstage renders. It is one template literal, which
has a sharp edge: a stray backtick truncates the whole thing, and a single
backslash before digits is a legacy octal escape that fails the app build while
`tsc` stays silent. `styles.test.ts` guards both.

**Backstage's own components are styled through the theme**, not by hashed
class names — `theme.tsx` uses the published override keys, which are typed, so
a renamed slot fails the build rather than silently unstyling a page. What is
left in CSS targets stable MUI global classes and canon's `--bui-*` variables.

**A route gets a class so a general selector can be specific again.**
`routeClass.ts` maps a pathname to one `sc-route-*` class on the root element.
Production builds discard `makeStyles` names, so a selector cannot name the
scaffolder's card grid; only `Mui*` survives, and `.MuiCard-root` is every card
in the app. Scoping by route is what narrows it.

The list is ordered and the **first match wins**, which is load-bearing rather
than incidental: entries match a prefix *and everything beneath it*, so
`/create` alone also claimed `/create/tasks/<id>` and painted the template-card
frieze over the task page's own controls. `/create/tasks` sits ahead of
`/create` for exactly that reason. Adding a route means asking which existing
prefix already swallows it.

**Sprites are character grids.** A 16×16 (or small 8×8) array of `#` and `.`,
run-merged into rects and rendered as SVG or drawn to canvas for the favicon.
Some carry a second layer — `~` for a potion's liquid or a rupee's fill — so
one grid can be drawn twice in two colours rather than kept as two sprites that
have to stay aligned by hand.

**Colour comes from one variable.** `--sc-primary` is set by the picker and
everything accent-coloured reads it, which is why the mark, the favicon, the
header art and the sparkles all recolour together.

**The potion box can be moved.** The picker is furniture, and furniture that
covers the last row of a table is in the way — so it can be dragged anywhere,
and where it is put is remembered. Both the chosen colour and the position live
in `localStorage`, so they follow the browser rather than the account — unlike
recently-visited and favourites, which are server-backed per user. The picker
also renders on the sign-in gate, where there is no API to read from, which is
what forces the choice.

Two details are load-bearing rather than decorative:

- A press only becomes a drag after 4px of travel. Without that threshold, any
  drag beginning on a bottle would also change the colour scheme — the click
  that follows a drag is swallowed for the same reason.
- The dropped position is clamped to the viewport, on release *and* on window
  resize. A position that fits a wide window is off the edge of a narrow one,
  and a picker you cannot reach is one you cannot drag back.

While it moves, the bottles rattle in their slots, staggered so they are out of
phase — in unison it reads as the shelf vibrating rather than as loose objects.
The rattle animates the sprite, not the button, because the button's transform
already belongs to the hover and selected lifts.

## Light and dark

`.sc-dark` on the root element chooses which set of tokens is live, and it has
to agree with the theme Backstage is actually rendering — the two paint
different halves of the same screen. MUI supplies the text colour, our tokens
supply `body`'s background, so a disagreement is not a mismatch of taste but an
unreadable app.

The subtle case is **no choice at all**. Until someone picks a theme, Backstage
renders whichever variant matches `prefers-color-scheme`, and the active theme
id is undefined. Treating that as light is wrong for every default account on a
dark-mode machine: MUI paints white text, our background stays light, and the
result is white on white. An unset theme therefore follows the system, and
changing the system preference updates it live. An explicit choice always wins —
that is what choosing means.

## Where colour deliberately ignores the picker

The experience bar is yellow while a workflow runs, green when it lands, red
when it does not — regardless of the picked *accent*. Status has to mean the
same thing across a working session; a bar that is violet on Tuesday and amber
on Wednesday says nothing at a glance.

The rule is about the accent, and there is exactly one exception: a **mode**
potion may redefine status hue, and Ancient Greek does — laurel-gold, Styx
cyan, ember. What makes that admissible rather than a hole in the rule is that
it is wholesale and measured:

- A mode redefines **every** status token or none of them. A partial override
  puts a default colour on a surface it was never measured against, which is
  why `contrast.test.ts` checks that each mode covers the same token names.
- The text label is untouched. `SUCCEEDED` is still the word on the badge, so
  no meaning rests on hue alone and the change costs consistency, not access.
- Every pair is re-measured against **that mode's** card colours, to the same
  5.0:1 target as the defaults.

The cost is real and worth naming: Greek's gold success sits near the amber
that means *running* elsewhere. Success is pushed to 60° rather than a straight
gold to open that gap to 25°, and running moves to a cold 188° cyan that no
other scheme uses.

## Mode potions

Six of the seven bottles are one accent hue. The seventh, Ancient Greek, is a
*mode*: it carries a whole palette and its own chrome, hung off a single
`sc-greek` class on the root element.

That works on specificity alone. The injected accent sheet writes `:root`,
which is (0,1,0); `:root.sc-greek` is (0,2,0) and wins whatever the injection
order, and `:root.sc-greek.sc-dark` is (0,3,0) and settles the dark register
over both. `sc-konami` has always worked this way — the mode potion is the same
mechanism, persisted instead of thrown away on reload.

Its CSS lives in `greek.ts`, not `styles.ts`. That is not tidiness: `styles.ts`
is a single template literal that a stray backtick has silently truncated
twice, and a second complete art direction inline makes a known hazard worse.
`greek.test.ts` carries a parity check that every colour token the default
`:root` declares is declared in both Greek registers — a half-declared mode
inherits a colour from the wrong register and degrades into unreadable text
rather than an obvious break.

## Motion

Every animation uses `steps()`, never `ease`. Smooth interpolation is what
makes a pixel interface look like a modern interface wearing a costume, so the
rule is absolute — including for third-party motion: React Flow's animated
graph edges are stepped here too.

Everything timed sits inside `@media (prefers-reduced-motion: no-preference)`,
and the reduced case is designed rather than merely disabled: the tour's
sparkles simply appear instead of blinking, and the creatures on the experience
bar are **absent** rather than frozen, because a static creature on a bar is a
smudge.

Nothing conveys state through motion alone.

## Accessibility, concretely

- Sprites are `aria-hidden`; state is always in text as well.
- Contrast is measured, not eyeballed. The dither pass found every badge
  variant already below WCAG AA — the worst at 1.84:1 — and fixed them; the
  check samples the rendered pixel against its text in all six schemes.
- The pixel font is used at 12px minimum and never for long-form documentation.
  It renders true lowercase, not the all-caps-shaped-as-lowercase of the
  earlier pixel face; chrome (titles, buttons, badges, nav, labels, table
  headers) is still uppercase, but that's a deliberate style choice, not the
  font compensating for missing lowercase forms.
- Progress bars carry their numbers (`2/3 STEPS`), which is both the NES
  convention and the readable one.

## Why dither instead of transparency

The NES had no alpha channel, so a tint was a checkerboard. Badge fills, the
success notice and the table row hover are 4px dither patterns rather than flat
washes, which is what makes them read as a grid rather than a pale rectangle.
It is also the reason the contrast pass was necessary: a checkerboard reads
about half a step lighter than the equivalent wash.

## What this costs

The styling reaches into components this repo does not own. That is a real
maintenance surface, and it is documented separately in
**[What an upgrade can break](upgrade-surface.md)** — read that before taking a
Backstage upgrade.
