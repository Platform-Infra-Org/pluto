# Template Header Images — Design & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator drop image files into a folder and have them become the software-template card headers, cropped to fit, at a configurable size, cycling across the cards.

**Architecture:** The bundler globs a fixed root (`packages/app/src/branding/`) at build time and hands the app a manifest of every image it found. At runtime, config selects which subfolder of that tree to use, and `platform-ui` generates one CSS rule per image — `nth-child` cycling over the template grid — injected the same way the accent colour already is. No React override of Backstage's template card.

**Tech Stack:** TypeScript, rspack (`import.meta.webpackContext`), the existing `SHADCN_CSS` injection in `platform-ui`, Backstage frontend config.

## Global Constraints

- Branch: `feat/8bit-ui` (continues the redesign) unless the operator asks for a separate branch.
- The existing Greek-key pixel art stays as the fallback: with no images supplied, nothing changes.
- Images are decorative. They must not affect the accessible name of a card, and they must not become the only way to tell templates apart.
- The colour picker keeps working: whatever is not covered by an image still derives from `--sc-primary`.
- Run tests from `backstage/`: `CI=true yarn test [path-filter]`.
- Every task ends green: `yarn tsc`, `CI=true yarn test`, `yarn lint:all`.
- No backticks in `styles.ts` — the stylesheet is one template literal, and a backtick in a comment truncates it. `styles.test.ts` guards this.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Supplying images | **Drop-in folder** — copy files in, nothing else | The operator asked for drop-in. No config edit, no script, no list to maintain |
| Folder location | **Configurable subfolder, with a default** — `app.branding.templateHeaders.dir`, default `template-headers` | As requested. See the constraint below for why it is a subfolder rather than a free path |
| Enumeration | `import.meta.webpackContext` over `src/branding/` at build time | A browser cannot list a directory. The bundler can, and it is the only mechanism that needs no second step from the operator |
| Rotation | **Cycle by card position**, `nth-child` | Chosen by the operator. Pure CSS, no component override |
| Cropping | `background-size: cover` + configurable `object-position` | Crops overflow rather than distorting. A 4000px photo and a 400px sprite both fill the header |
| Sizing | `app.branding.templateHeaders.height`, default `90px` | The current header height, so supplying images changes nothing about layout by default |

### The one constraint worth stating plainly

`import.meta.webpackContext` needs a **static** path — it is resolved when the bundle is built, before any config is read. So the configured value cannot be an arbitrary filesystem path; it selects a **subfolder of a fixed root**:

```
packages/app/src/branding/          <- fixed root, globbed at build time
  template-headers/                 <- the default subfolder
  greek-vases/                      <- another set, selected by config
```

```yaml
app:
  branding:
    templateHeaders:
      dir: greek-vases    # default: template-headers
```

This gives drop-in behaviour *and* a configurable, documented folder. If a folder outside the bundle is ever needed — images mounted at deploy time, say — that is a different mechanism (a manifest under `public/`), and it is recorded under **Not doing** below.

### Rotation semantics

With N images and M templates, card *i* gets image *i mod N*. Filtering the template list reshuffles which image a card shows; that was accepted explicitly when choosing position-cycling over per-template stability.

---

## File Structure

| File | Responsibility |
|---|---|
| `backstage/packages/app/src/branding/template-headers/` | **New.** The drop-in folder. Ships with a `README.md` and no images |
| `backstage/packages/app/src/branding/index.ts` | **New.** The build-time glob; exports `BRANDING_IMAGES: Record<string, string[]>` keyed by subfolder |
| `backstage/plugins/platform-ui/src/templateHeaders.ts` | **New.** Pure function: image list + options → CSS text. No DOM, no React |
| `backstage/plugins/platform-ui/src/templateHeaders.test.ts` | **New.** Unit tests for that function |
| `backstage/plugins/platform-ui/src/SchemeRoot.tsx` | Injects the generated CSS, next to the accent rule |
| `backstage/plugins/platform-ui/config.d.ts` | The three new config keys |
| `backstage/app-config.yaml` | Commented example |
| `docs/how-to/rebrand-the-portal.md` | How to supply headers |

---

## Task 1: The build-time glob

**Files:**
- Create: `backstage/packages/app/src/branding/index.ts`
- Create: `backstage/packages/app/src/branding/template-headers/README.md`

**Interfaces:**
- Produces: `BRANDING_IMAGES: Record<string, string[]>` — subfolder name → array of resolved image URLs, sorted by filename.

- [ ] **Step 1: Create the drop-in folder with its README**

`packages/app/src/branding/template-headers/README.md`:

```markdown
# Template header images

Drop image files in here and they become the software-template card headers,
in filename order. Nothing else to do — no config, no script.

- Formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`
- Recommended size: **752×180** (the header renders at 376×90; double for retina)
- Anything larger is cropped to fill, not squashed
- Remove an image by deleting the file; reorder by renaming

To use a different folder, create a sibling of this one and point config at it:

    app:
      branding:
        templateHeaders:
          dir: my-other-folder
```

- [ ] **Step 2: Write the glob**

`packages/app/src/branding/index.ts`:

```ts
/**
 * Every image under this directory, grouped by its immediate subfolder.
 *
 * The glob is resolved by the bundler at build time — a browser cannot list a
 * directory, so this is what makes the folder drop-in. The root has to be a
 * literal for the same reason: it is read before any config exists. Config
 * chooses which subfolder to use, not where the root is.
 */
const ctx = import.meta.webpackContext('.', {
  recursive: true,
  regExp: /\.(png|jpe?g|webp|gif|svg)$/i,
});

export const BRANDING_IMAGES: Record<string, string[]> = {};

for (const key of ctx.keys().sort()) {
  // './template-headers/amphora.png' -> 'template-headers'
  const dir = key.split('/')[1];
  if (!dir || !key.startsWith(`./${dir}/`)) continue;
  (BRANDING_IMAGES[dir] ??= []).push((ctx(key) as { default: string }).default);
}
```

- [ ] **Step 3: Verify the glob compiles and yields an empty set**

```bash
cd backstage && yarn tsc
```

Expected: clean. With no images in the folder, `BRANDING_IMAGES` is `{}` — the fallback path.

If `import.meta.webpackContext` is not recognised by the TypeScript config, add the ambient declaration to the same file rather than reaching for `require.context` (which is the webpack-4 spelling and is not what this bundler uses):

```ts
declare global {
  interface ImportMeta {
    webpackContext(
      request: string,
      options?: { recursive?: boolean; regExp?: RegExp },
    ): { keys(): string[]; (id: string): unknown };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add backstage/packages/app/src/branding
git commit -m "feat(app): glob a drop-in branding folder at build time"
```

---

## Task 2: The CSS generator

Pure function, so it is the part that gets real tests.

**Files:**
- Create: `backstage/plugins/platform-ui/src/templateHeaders.ts`
- Create: `backstage/plugins/platform-ui/src/templateHeaders.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export interface TemplateHeaderOptions {
    images: string[];
    height?: string;   // default '90px'
    position?: string; // default 'center'
  }
  export function templateHeaderCss(opts: TemplateHeaderOptions): string;
  ```
  Returns `''` for an empty image list, so the caller can inject unconditionally.

- [ ] **Step 1: Write the failing test**

`templateHeaders.test.ts`:

```ts
import { templateHeaderCss } from './templateHeaders';

const CARD = '[class*="BackstageItemCardGrid-root"] > .MuiCard-root';

describe('templateHeaderCss', () => {
  it('is empty when no images are supplied, so the pixel art stays', () => {
    expect(templateHeaderCss({ images: [] })).toBe('');
  });

  it('cycles the images across card positions', () => {
    const css = templateHeaderCss({ images: ['/a.png', '/b.png'] });
    expect(css).toContain(`${CARD}:nth-child(2n + 1)`);
    expect(css).toContain(`${CARD}:nth-child(2n + 2)`);
    expect(css).toContain('url("/a.png")');
    expect(css).toContain('url("/b.png")');
  });

  it('emits one rule per image', () => {
    const css = templateHeaderCss({ images: ['/a.png', '/b.png', '/c.png'] });
    expect((css.match(/nth-child/g) ?? []).length).toBe(3);
  });

  it('crops rather than squashes, and fills the header', () => {
    const css = templateHeaderCss({ images: ['/a.png'] });
    expect(css).toContain('background-size: cover');
    expect(css).toContain('background-repeat: no-repeat');
  });

  it('applies the configured height and position', () => {
    const css = templateHeaderCss({
      images: ['/a.png'],
      height: '120px',
      position: 'top left',
    });
    expect(css).toContain('height: 120px');
    expect(css).toContain('background-position: top left');
  });

  it('defaults to the current header height', () => {
    expect(templateHeaderCss({ images: ['/a.png'] })).toContain('height: 90px');
  });

  it('escapes quotes in a filename rather than breaking out of url()', () => {
    const css = templateHeaderCss({ images: ['/a"b.png'] });
    expect(css).not.toContain('url("/a"b.png")');
    expect(css).toContain('%22');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backstage && CI=true yarn test plugins/platform-ui/src/templateHeaders.test.ts
```

Expected: FAIL — `Cannot find module './templateHeaders'`.

- [ ] **Step 3: Write the generator**

```ts
/** Cards are direct children of the grid; the header is a descendant of each. */
const CARD = '[class*="BackstageItemCardGrid-root"] > .MuiCard-root';
const HEADER = '[class*="ItemCardHeader"]';

export interface TemplateHeaderOptions {
  images: string[];
  /** Header height. Default '90px' — what the cards already render at. */
  height?: string;
  /** background-position for the crop. Default 'center'. */
  position?: string;
}

/**
 * One rule per supplied image, cycling across card positions: card i shows
 * image i mod N. Returns '' when no images are supplied, so the caller can
 * inject unconditionally and the pixel-art fallback stays in place.
 */
export function templateHeaderCss(opts: TemplateHeaderOptions): string {
  const { images, height = '90px', position = 'center' } = opts;
  if (images.length === 0) return '';

  const n = images.length;
  const rules = images.map((src, i) => {
    // encodeURI leaves '/' and ':' alone but neutralises quotes and spaces,
    // so a filename can never terminate the url() and inject a declaration.
    const safe = encodeURI(src).replace(/"/g, '%22');
    return [
      `${CARD}:nth-child(${n}n + ${i + 1}) ${HEADER} {`,
      `  background-image: url("${safe}") !important;`,
      `  background-size: cover !important;`,
      `  background-position: ${position} !important;`,
      `  background-repeat: no-repeat !important;`,
      `}`,
    ].join('\n');
  });

  return [
    `${CARD} ${HEADER} { height: ${height}; }`,
    ...rules,
  ].join('\n');
}
```

- [ ] **Step 4: Run the tests**

```bash
cd backstage && CI=true yarn test plugins/platform-ui/src/templateHeaders.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/templateHeaders.ts \
        backstage/plugins/platform-ui/src/templateHeaders.test.ts
git commit -m "feat(ui): generate cycling template-header CSS from an image list"
```

---

## Task 3: Config and injection

**Files:**
- Modify: `backstage/plugins/platform-ui/config.d.ts`
- Modify: `backstage/plugins/platform-ui/src/SchemeRoot.tsx`
- Modify: `backstage/packages/app/src/App.tsx`
- Modify: `backstage/app-config.yaml`

**Interfaces:**
- Consumes: `BRANDING_IMAGES` (Task 1), `templateHeaderCss` (Task 2).
- Produces: `setTemplateHeaders(images: string[], opts)` in `SchemeRoot.tsx`, mirroring the existing `setBranding` relay.

- [ ] **Step 1: Declare the config**

In `config.d.ts`, inside `branding`:

```ts
      /**
       * Software-template card headers, supplied as images.
       *
       * Drop files into `packages/app/src/branding/<dir>/` and they are used in
       * filename order, cycling across the cards. With no images, the built-in
       * pixel art is used instead.
       */
      templateHeaders?: {
        /**
         * Subfolder of `packages/app/src/branding/` to read.
         * @default template-headers
         * @visibility frontend
         */
        dir?: string;
        /**
         * Header height, any CSS length.
         * @default 90px
         * @visibility frontend
         */
        height?: string;
        /**
         * How the crop is anchored, any CSS background-position.
         * @default center
         * @visibility frontend
         */
        position?: string;
      };
```

- [ ] **Step 2: Relay the images from the app**

`packages/app/src/branding/index.ts` lives in the app, and `platform-ui` must not import from the app. So the app passes them in, the same way config is passed today. In `SchemeRoot.tsx`, beside the existing `branding` relay:

```tsx
let templateHeaderImages: string[] = [];

/** The app owns the bundled images; platform-ui only styles with them. */
export function setTemplateHeaderImages(images: string[]) {
  templateHeaderImages = images;
  applyScheme();
}
```

- [ ] **Step 3: Inject the generated CSS**

Inside `applyScheme`, after the accent rule is written:

```ts
  ensureStyle(
    'sc-template-headers',
    templateHeaderCss({
      images: templateHeaderImages,
      height: brandingHeaderHeight,
      position: brandingHeaderPosition,
    }),
  );
```

`brandingHeaderHeight` and `brandingHeaderPosition` come from the same
`setBranding` relay that already carries `mark` and `favicon` — extend its
argument type with `headerHeight?: string; headerPosition?: string`, read in
`SchemeRoot` from `app.branding.templateHeaders.height` / `.position`.

- [ ] **Step 4: Wire the app side**

In `packages/app/src/App.tsx`, before `createApp`:

```tsx
import { BRANDING_IMAGES } from './branding';
import { setTemplateHeaderImages } from '@internal/plugin-platform-ui';

// The configured subfolder is read in SchemeRoot; the app supplies every
// bundled set and lets the plugin pick.
setTemplateHeaderImages(BRANDING_IMAGES.___dir___ ?? []);
```

**Interface note for the implementer:** the app cannot read config at module
scope, so pass the *whole map* rather than one folder's images, and let
`SchemeRoot` select using the configured `dir`:

```tsx
setBrandingImages(BRANDING_IMAGES);              // app side
// SchemeRoot: images = BRANDING_IMAGES[cfg.dir ?? 'template-headers'] ?? []
```

Use that shape. Export `setBrandingImages(map: Record<string, string[]>)` from
`platform-ui`'s `index.ts`.

- [ ] **Step 5: Document the config in app-config.yaml**

Under the existing `branding` block:

```yaml
    # Software-template card headers. Drop images into
    # packages/app/src/branding/<dir>/ and they are used in filename order,
    # cycling across the cards; with no images the built-in pixel art is used.
    # templateHeaders:
    #   dir: template-headers   # subfolder of packages/app/src/branding/
    #   height: 90px            # any CSS length
    #   position: center        # any CSS background-position
```

- [ ] **Step 6: Verify**

```bash
cd backstage && yarn tsc && CI=true yarn test && yarn lint:all
```

Then, with the dev server running and **no** images supplied, confirm the
template cards still show the Greek-key pixel art — the fallback path is the
one most likely to regress.

- [ ] **Step 7: Commit**

```bash
git add backstage/plugins/platform-ui backstage/packages/app/src/App.tsx backstage/app-config.yaml
git commit -m "feat(ui): use supplied images as template headers, cycling across cards"
```

---

## Task 4: Prove it with real images

**Files:**
- Temporary: three images in `packages/app/src/branding/template-headers/`

- [ ] **Step 1: Generate three test images at the recommended size**

```bash
cd backstage/packages/app/src/branding/template-headers
python3 - <<'PY'
# Three flat 752x180 PNGs, distinct colours, so cycling is visible at a glance.
import struct, zlib
def png(path, rgb):
    w, h = 752, 180
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c))
    open(path, 'wb').write(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(raw))
        + chunk(b'IEND', b''))
for name, rgb in [('a-red.png', (200, 60, 60)),
                  ('b-green.png', (60, 160, 90)),
                  ('c-blue.png', (60, 90, 200))]:
    png(name, rgb)
PY
ls -l
```

- [ ] **Step 2: Confirm cycling in the browser**

With five templates and three images, expect red, green, blue, red, green.

```bash
cd backstage && node scripts/screenshot.mjs /tmp/headers 'body' 'http://localhost:3000/create'
```

Check the capture: five cards, colours cycling in that order, each image filling
its header with no letterboxing and no distortion.

- [ ] **Step 3: Confirm cropping**

Replace one image with a deliberately wrong aspect ratio (e.g. 2000×200) and
confirm it fills the header by cropping, not by squashing — the content should
be centre-anchored and the header height unchanged.

- [ ] **Step 4: Confirm the size config**

Set `height: 140px` in `app-config.yaml`, restart, and confirm every header
grows and the images still fill without distortion.

- [ ] **Step 5: Remove the test images**

```bash
rm backstage/packages/app/src/branding/template-headers/{a-red,b-green,c-blue}.png
```

Confirm the pixel-art fallback returns.

- [ ] **Step 6: Commit the docs**

Update `docs/how-to/rebrand-the-portal.md` with a "Template card headers"
section: the folder, the recommended 752×180, the three config keys, the
cycling rule, and the fallback. Then:

```bash
git add docs/how-to/rebrand-the-portal.md
git commit -m "docs: how to supply template header images"
```

---

## Verification

- `yarn tsc`, `CI=true yarn test`, `yarn lint:all`, `yarn build:all` all green.
- With no images: template cards show the Greek-key pixel art, unchanged.
- With three images and five templates: 1, 2, 3, 1, 2 across the cards.
- An oversized image crops rather than distorts.
- `height` and `position` config take effect.
- The colour picker still repaints the fallback art.

## Not doing

- **Per-template stable images.** Position-cycling was chosen deliberately;
  filtering the list reshuffles which image a card shows.
- **Images from outside the bundle** (a mounted volume, a CDN). That needs a
  manifest under `public/` and a fetch, which is a different mechanism — and the
  CSP is `img-src 'self' data:`, so a remote host would need a CSP change too.
- **Per-template overrides** (`spec.profile.picture`-style annotations). Ask for
  it if the rotation is not enough.
- **Runtime image processing** — no resizing or re-encoding on the server. The
  crop is CSS; the file ships as supplied.
