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
Input geometry — label position, the outline notch, outline width — lives in
`theme.tsx` override keys; `styles.ts` may colour an input but must not
reposition its label, because a route-scoped selector cannot tell MUI's
standard variant from its outlined one and the inset one needs knocks the other
off its own notch.

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

**The sign-in card carries the same box.** It used to lay every bottle out flat,
which worked while there were seven of them and stopped working at fifteen: the
card is 296px of content box and a flat shelf needs 442px, so the sprites were
squeezed below their own 16px grid and got worse with every potion added. Both
instances now show one bottle and open the full inventory in a tray, which is
the same interaction in both places and does not grow with the scheme count.
The two behaviours are separately controlled — `floating` is the fixed
placement and the drag, `compact` is the tray without them — because the login
card wants the tray and must not become a floating shelf.

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
- Every pair is re-measured against **that mode's** card colours. The suite
  enforces WCAG AA, 4.5:1; the literals themselves are chosen at the lowest
  lightness clearing 5.0:1, so there is headroom above the line rather than a
  value sitting exactly on it.

The cost is real and worth naming: Greek's gold success sits near the amber
that means *running* elsewhere. Success is pushed to 60° rather than a straight
gold, 22° from the amber text hue and 25° from the amber badge fill it sits on,
and running moves to a cold 188° cyan that no other scheme uses.

## Mode potions

Every bottle on the shelf is now a *mode*: it carries a whole palette and its
own chrome, hung off a single `sc-<id>` class on the root element. There are
fifteen, and they arrived in two kinds. Seven are **table-driven** — a row in
`brands.ts` with two registers of colour and a radius, which is all a mode needs
when it is a recolour. Eight are **hand-written sheets**, one file each, because
a `BRAND_DEFS` row cannot express ornament or an animation:

- **Ancient Greek** (`greek.ts`) — bronze on bone, gold on obsidian; meander,
  palmette, fluted column, rosette. The one mode that redefines status hue.
- **Agence Foudre** (`foudre.ts`), **Slush** (`slush.ts`) and **Spider-Verse**
  (`spiderverse.ts`) — three reference design systems rendered in this app's
  furniture.
- **Hanami** (`hanami.ts`) — the Japanese mode, and the only one that leads
  *light*: gofun white ground, sumi ink, enji vermilion, ai-iro indigo
  linework, all named traditional dyes rather than a hue wheel. Seigaiha runs
  under every page title, a torii stands on an empty shelf, and sakura fall
  across the viewport on a four-frame tumble strip. Two of its colours —
  sakura-iro and yamabuki — are marked decorative-only in the sheet, because
  both measure under 2:1 on the card and the pink is exactly what the next
  person will reach for. Kurenai is *not* the primary: it clears AA at 4.96 and
  misses this repo's 5.0 bar, so enji takes the slot.
- **Nightshade** (`nightshade.ts`) — witch green over violet with gold
  filigree, dark-first. The read is art nouveau, which is a documented lineage
  rather than a guess: Jen Zee has named Mucha and Klimt as Supergiant's
  reference, and the cool green shift is Hades II's own. It takes the grammar
  and none of the assets — no Melinoe or Hecate silhouette, no logotype or
  laurel lockup, no boon-rarity ramp, which would collide with our status
  semantics anyway. Its motion is an eight-phase moon on `steps(8)`; anything
  smoother slides the strip mid-frame and shows two half-moons at once.
- **Rimefast** (`rimefast.ts`) — the Norse mode, cold and much louder than the
  screen convention. There is no brown in it on purpose: orpiment, lead-oxide
  red, hematite, copper green, vivianite, madder, woad and lichen purple are
  all identified from Viking Age finds, and "medieval brown" is a television
  habit. Its motion is a dithered aurora across the top rail, six frames at
  800ms, which reads as a shimmer where a smooth version reads as a banner
  sliding past.

  **Rimefast excludes five genuine Norse forms, deliberately.** The Valknut,
  Othala, Sowilo (the sig-rune), the Tyr rune and the sunwheel do not appear,
  because all five are catalogued as appropriated extremist symbols and a
  corporate portal cannot control how one of them is read. Ravens, Yggdrasil,
  knotwork and a generic non-semantic futhark band carry no such freight and are
  what the mode uses. `rimefast.test.ts` asserts the sheet never names the five,
  so completing the set in a year's time fails a test rather than a shipping
  review. This paragraph is the reason, kept next to the rule.
- **Ancient Egyptian** (`egyptian.ts`) — pigment rather than sand; beige is
  what four thousand years of weathering left, not what anyone painted. The
  light register is **lapis and Egyptian blue on a cool limestone white**, with
  gold demoted to an accent, and it is that way on purpose: as papyrus-and-
  ochre it read as the same room as Ancient Greek's parchment-and-bronze, and
  two warm grounds carrying a warm metal is one design with two names. The dark
  register is a tomb interior — gold leaf and Egyptian blue lit against black.
  Both cards are solved backwards from the shared status set and both are
  pinned: the light one cannot fall below 96% lightness (warning-on-cell is
  4.99 at 95%) and the dark one cannot rise above 7% (4.90 at 8%). The ornament
  is hieroglyphic: a four-sign glyph register (ankh, feather of Maat, water
  ripple, reed over a ground line) under every page title and along both edges
  of a command window, papyrus down the sidebar, djed pillars and a facing pair
  of wedjat eyes at the sign-in threshold with a cartouche between them, an
  ankh on an empty shelf, and the Aten stepping its rays in the bottom-right
  corner on two frames, 800ms a frame. **The signs are real and the arrangement
  is deliberately not a sentence** — a band of genuine glyphs in sequence spells
  something and a decorative band that spells something spells it wrong, so the
  cartouche holds one ankh rather than a name. `sprites.ts` says so beside the
  grids, because the obvious later "fix" is to make it read. Malachite is
  confined to the sign-in page — it sits 16° from the success status hue, and
  green ornament beside a badge turns decoration into state;
  `egyptian.test.ts` fails if it appears anywhere else.

The mechanism is specificity alone. The injected accent sheet writes `:root`,
which is (0,1,0); `:root.sc-greek` is (0,2,0) and wins whatever the injection
order, and `:root.sc-greek.sc-dark` is (0,3,0) and settles the dark register
over both. `sc-konami` has always worked this way — the mode potion is the same
mechanism, persisted instead of thrown away on reload.

Each sheet lives in its own file, not in `styles.ts`. That is not tidiness:
`styles.ts` is a single template literal that a stray backtick has silently
truncated twice, and a whole art direction inline makes a known hazard worse.
Only the import and one `${…}` interpolation go into `styles.ts`, and
`styles.test.ts` names each `:root.sc-<id>` in its marker list — without that, a
mode sheet can be perfectly correct and simply never reach the page. Every mode
also carries a parity check that both its registers declare every colour token
the default `:root` declares: a half-declared mode inherits a colour from the
wrong register and degrades into unreadable text rather than an obvious break.

Adding one touches ten files, and `docs/superpowers/plans/` records the
checklist. The parts that catch people: `MODE_CARDS` must hold the *same* card
value the sheet emits, or `contrast.test.ts` measures a colour nothing paints;
the mode must be added to `contrast.test.ts` by hand, because hand-written
sheets are not discovered from `BRAND_DEFS`; and a baked sprite fill is a
literal inside an SVG data URI, which inherits neither `currentColor` nor a
custom property, so a two-colour motif is two URIs that have to be kept in step.

The five animated modes share one host. `SchemeRoot` mounts `.sc-mode-art`
once, unconditionally and `aria-hidden`, and each mode sheet turns on the child
it draws. It is not branched on the picked scheme because `applyScheme` runs
before React and writes a class on the root element — a React copy of "which
mode" would be a second source of truth that can disagree with the class
actually applied.

## Motion

Every animation uses `steps()`, never `ease`. Smooth interpolation is what
makes a pixel interface look like a modern interface wearing a costume, so the
rule holds for the default theme and for third-party motion alike: React Flow's
animated graph edges are stepped here too.

There is one exception, and it is the same shape as the status-hue one: a
**mode** potion may redefine the easing vocabulary. A mode exists to render
another design system in this app's furniture, and for some of them the timing
*is* the design — Agence Foudre transitions nearly a thousand elements on
`cubic-bezier(.23, 1, .32, 1)`, and reproducing its colours over stepped timing
would be that design wearing this one's clock. Three conditions make it an
exception rather than a hole:

- **Wholesale.** A mode declares its own curves as tokens and uses them
  consistently. Mixing smooth and stepped inside one theme is the failure this
  rule exists to prevent, and it looks worse than either alone.
- **The reduced-motion contract is unchanged.** Everything timed still sits
  inside the query, and the still frame is still designed.
- **Nothing conveys state through motion alone**, which was never negotiable.

The default theme keeps `steps()`, and so do Ancient Greek, Hanami,
Nightshade, Rimefast and Ancient Egyptian — in all five animated modes the
stepping is load-bearing rather than stylistic. A petal interpolated between
pixel rows blurs, a moon strip interpolated between frames shows two
half-moons at once, an aurora interpolated across its tile reads as a banner
sliding past rather than a curtain moving, and the Aten has nowhere to
interpolate *to*: its two frames are the same eight rays turned 45°, so an
in-between position is a position the rays are never in.

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
  check samples the rendered pixel against its text in every scheme.
- **One typeface.** Clash Grotesk is the app's only family, self-hosted because
  the CSP is `font-src 'self'` — a CDN reference fails silently, the page
  falling back to something that looks nearly right. Differentiation comes from
  weight, size and case rather than from a second family, which is also what
  lets a mode change the whole voice by moving one variable.

  It replaced a pixel face, and the type scale changed with it. The arcade
  treatment uppercased every piece of chrome and held a hard 12px floor: both
  were right for a bitmap-derived face and wrong for an outline grotesque, where
  uppercase at 13px reads as shouting. Uppercase now survives in exactly one
  place — the micro-label and its sibling the table header — where it is a
  wayfinding convention rather than a texture, and it carries the positive
  tracking uppercase always needs. Everything else is sentence case with slight
  negative tracking, which is how this family is drawn to be set.
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
