# How-to: change the logo, favicon and title

Four independent surfaces carry the branding. Each has exactly one place to
change it.

## 1. The platform mark (sidebar + sign-in)

One definition, three render sites:

| | |
|---|---|
| **Change here** | `backstage/plugins/platform-ui/src/components.tsx` → `PlatformMark` |
| Rendered by | `platform-ui/src/CustomNav.tsx` (sidebar header), `packages/app/src/modules/auth.tsx` (sign-in card, ×2) |

It's a plain inline SVG — swap the `<path>`/`<rect>` elements for your own. Keep
three things or it will stop behaving:

- `viewBox="0 0 24 24"` — the nav tile and sign-in card size it by their own CSS.
- `fill="currentColor"` — this is what makes the mark follow the theme and the
  accent picker. A hard-coded fill will look wrong in dark mode.
- `aria-hidden="true"` — adjacent text already names the product; a second
  announcement is noise for screen readers.

Inline SVG (not an `<img>`) is deliberate: it inherits colour, costs no request,
and can't render as a broken-image icon if the asset path shifts.

## 2. The browser favicon

Static files, referenced by name from `backstage/packages/app/public/index.html`.
Replace them **in place** — same filenames, same sizes — and no code changes at
all:

| File | Used for |
|---|---|
| `favicon.ico` | browser tab (also `rel="shortcut icon"`) |
| `favicon-16x16.png`, `favicon-32x32.png` | modern tab icons |
| `apple-touch-icon.png` (180×180) | iOS home screen |
| `android-chrome-192x192.png` | Android home screen (via `manifest.json`) |
| `safari-pinned-tab.svg` | Safari pinned tab — monochrome mask; its tint is the `color` attribute on the `mask-icon` link in `index.html` |

All of these live in `backstage/packages/app/public/`.

Browsers cache favicons aggressively and ignore a normal reload. Hard-refresh, or
open the file URL directly, before concluding it didn't work.

## 3. The web-app manifest

`backstage/packages/app/public/manifest.json` — `name`, `short_name`,
`theme_color`, `background_color`, and the icon list. This is what an installed
PWA shows.

## 4. The page title

Config, not code: `app.title` in `backstage/app-config.yaml`. `index.html` reads
it at build time (`config.getOptionalString('app.title') ?? 'Backstage'`).

---

**Colours** are a separate surface again — the design tokens (`--sc-primary`,
`--sc-bg`, …) live in `platform-ui/src/styles.ts`, and the accent is what the
in-app colour picker rewrites at runtime.

**Not configurable at runtime.** All of the above are build-time: the mark is a
component, the icons are static assets. Making the logo swappable per deployment
would mean uploading an asset and injecting it — worth it if you ship this to
several tenants, pointless for one.
