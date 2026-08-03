# How-to: change the logo, favicon and title

The logo and the tab icon are **configuration** — no code change, no rebuild of
the plugin. The title is config too. Everything else (colours, the built-in
glyph) is code.

## Set the logo

1. Put the image in `backstage/packages/app/public/branding/`. Anything in
   `public/` is served from the site root, so `…/public/branding/mark.svg`
   becomes `/branding/mark.svg`.
2. Point config at it:

```yaml
app:
  title: Platform                 # the browser tab text
  branding:
    mark: /branding/mark.svg      # sidebar + sign-in tile, and the tab icon
```

That's it. The mark appears in the sidebar header, on the sign-in card, and —
composited over the accent colour — as the browser tab icon.

To go back to the built-in temple glyph, remove the key.

## What the tile does to your logo

The mark sits inside a rounded tile whose background is the **accent colour the
user picked** in the colour picker. Your image is drawn on top of it:

- **Opaque pixels keep their own colours** — your brand colours are preserved.
- **Transparent pixels show the tile**, so the surround changes when the user
  switches swatch.

This is why the image should have a transparent background. A logo exported on a
white background covers the tile completely and the picker will appear to do
nothing — that is the single most common mistake here.

### Choosing a logo that works with every swatch

The six accents all sit in a narrow lightness band (40–55%):

| Violet | Blue | Green | Rose | Amber | Slate |
|---|---|---|---|---|---|
| `250 52% 55%` | `217 60% 52%` | `152 42% 40%` | `345 55% 52%` | `32 70% 48%` | `215 20% 40%` |

- A **white or light monochrome** logo reads well against all six. This is what
  the built-in glyph does, and what most portal logos already are.
- A **mid-tone colour** logo is a gamble — an amber mark on the Amber swatch
  nearly disappears, a navy mark on Blue or Slate goes muddy.
- If the brand colours are non-negotiable and clash, set `favicon` explicitly and
  accept that the sidebar tile still recolours behind the mark.

Check all six swatches before shipping. It takes ten seconds.

## The tab icon

The tab icon is **generated**, always: a 64×64 rounded tile in the picked accent
colour with the logo drawn on it, redrawn every time the user changes swatch, so
the tab matches the sidebar. With no config at all that logo is the built-in
temple glyph; set `branding.mark` and it becomes your logo instead.

To pin a fixed icon and opt out of the theming:

```yaml
app:
  branding:
    mark: /branding/mark.svg
    favicon: /branding/tab.png    # used as-is; ignores the colour picker
```

The static files in `packages/app/public` (`favicon.ico`, `favicon-32x32.png`, …)
are still what the browser shows for the split second before JavaScript runs, and
they're the fallback if icon generation fails. Replace them too if that first
paint matters to you.

## Supported file types

| Use | Works | Notes |
|---|---|---|
| `branding.mark` (in-app) | `.svg`, `.png`, `.webp`, `.avif`, `.gif`, `.jpg` | anything an `<img>` renders. **Prefer `.svg`** — it stays sharp at 17px and 34px. `.jpg` has no transparency, so it will always be a rectangle over the tile |
| `branding.mark` (generated tab icon) | `.png`, `.webp`, `.gif`, `.jpg`, and `.svg` **with `width`/`height` attributes** | an SVG without intrinsic dimensions cannot be drawn to a canvas in some browsers; the tab icon then silently stays as-is. If in doubt use a `.png` for the mark, or add `width="24" height="24"` to the SVG root |
| `branding.favicon` | `.ico`, `.png`, `.svg`, `.gif` | `.ico` is the safest — Safari ignores SVG favicons |

**Same-origin only.** The Content-Security-Policy is `img-src 'self' data:`, so
`https://cdn.example.com/logo.svg` is blocked. Use a file under `public/`, or a
`data:` URI. (Cross-origin also taints the canvas, which would break the
generated tab icon even if the CSP allowed it.)

Browsers cache favicons aggressively and ignore a normal reload. Hard-refresh
before concluding it didn't work.

## Sizes, if you're drawing a new glyph

The tile is 26px in the sidebar and 52px on sign-in; the mark inside is 17px and
34px — **65% of the tile** in both cases, leaving padding so the shape clears the
rounded corners. Keep that ratio if you change the sizes. The generated tab icon
uses the same proportions on a 64px canvas.

An SVG mark should be authored on a **24×24 artboard** (`viewBox="0 0 24 24"`),
which is the coordinate space the built-in glyph uses. Below about 32px fine
detail disappears — the tab icon is rendered at 16–32px, so a busy logo will turn
to mush there. Simple marks win.

## What is still code

| | Where |
|---|---|
| The built-in glyph (fallback when `branding.mark` is unset) | `backstage/plugins/platform-ui/src/components.tsx` → `PlatformMark` |
| Tile size, radius, and the accent gradient | `platform-ui/src/styles.ts` (`.sc-nav-mark`, `.sc-login-mark`) |
| The colour palette itself | `platform-ui/src/SchemeRoot.tsx` → `SCHEMES` |
| Tab icon generation | `platform-ui/src/SchemeRoot.tsx` → `updateFavicon` |
| PWA manifest (installed-app name and icons) | `backstage/packages/app/public/manifest.json` |
