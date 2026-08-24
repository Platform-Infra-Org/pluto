import { ReactNode } from 'react';
import { AppRootWrapperBlueprint, ThemeBlueprint } from '@backstage/plugin-app-react';
import {
  AppRootElementBlueprint,
  PageBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import {
  createUnifiedTheme,
  genPageTheme,
  palettes,
  shapes,
  UnifiedThemeProvider,
} from '@backstage/theme';
import LightIcon from '@material-ui/icons/WbSunny';
import DarkIcon from '@material-ui/icons/Brightness2';
import { SchemeRoot } from './SchemeRoot';
import { navContent } from './CustomNav';
import { MaintenanceGate } from './MaintenanceGate';

// MUI theme = the Backstage chrome + native pages. The injected shadcn CSS
// (styles.ts) reskins those MUI surfaces to follow the color picker; this theme
// carries a matching neutral palette + flat component defaults.
const PRIMARY = '#6366f1';
const PRIMARY_DARK = '#818cf8';
const ACCENT = '#8b5cf6';
// Full arcade: the MUI theme's base face is the pixel one, so native Backstage
// components inherit it rather than falling back to Inter.
// Read through a variable so a mode potion can change the face. MUI freezes
// typography at theme construction, so a static string here would leave every
// native Backstage surface in the pixel font while our own pages changed.
const FONT =
  "var(--sc-font-ui, 'Pixelify Sans', ui-monospace, SFMono-Regular, monospace)";

type Tone = {
  primary: string;
  bg: string;
  surface: string;
  border: string;
  navBg: string;
};
const LIGHT: Tone = {
  primary: PRIMARY,
  bg: '#f6f6f8',
  surface: '#ffffff',
  border: '#e6e6ec',
  navBg: '#ffffff',
};
const DARK: Tone = {
  primary: PRIMARY_DARK,
  bg: '#0f0e15',
  surface: '#17151f',
  border: '#2a2733',
  navBg: '#17151f',
};

/**
 * A page theme whose gradient follows the picker.
 *
 * genPageTheme joins its `colors` into a literal `linear-gradient(90deg, …)` at
 * theme construction, so the ownership tiles on /catalog/default/group/* and
 * /user/* wore a baked indigo→violet in all nine modes and both registers —
 * the loudest element on those pages, and not reachable as a token from CSS.
 * The returned object is plain, so the gradient half is rewritten to read a
 * variable, exactly as GRAPH_OVERRIDES and --sc-header-art do. The shape URI
 * is taken from what genPageTheme itself produced rather than transcribed.
 *
 * Exported so a test can assert on it; the built theme is not introspectable.
 */
function pageThemeOf(shape: string) {
  const base = genPageTheme({ colors: [PRIMARY, ACCENT], shape });
  return {
    ...base,
    backgroundImage: `${shape},  linear-gradient(90deg, hsl(var(--sc-primary)), hsl(var(--sc-primary) / .65))`,
  };
}

export const pageThemes = {
  home: pageThemeOf(shapes.wave),
  documentation: pageThemeOf(shapes.wave2),
  tool: pageThemeOf(shapes.round),
  service: pageThemeOf(shapes.wave),
  other: pageThemeOf(shapes.wave),
  app: pageThemeOf(shapes.wave),
  apis: pageThemeOf(shapes.wave),
};

/**
 * The app visualizer's four override keys.
 *
 * Every value reads a token rather than a literal. The hex that used to sit
 * here was picked for one dark palette, so the graph stayed that colour in
 * every mode and in light mode — a dark canvas with pale nodes on a parchment
 * page. MUI freezes these at theme construction, so a CSS variable is the only
 * way they can follow the live theme, which is the same reason the header art
 * is reached through one.
 *
 * Exported so a test can assert on the object; the built theme is not
 * introspectable.
 */
export const GRAPH_OVERRIDES = {
    BackstageDependencyGraphNode: {
      styleOverrides: {
        node: { fill: 'hsl(var(--sc-card))', stroke: 'hsl(var(--sc-border))' },
      },
    },
    BackstageDependencyGraphDefaultNode: {
      styleOverrides: {
        node: {
          fill: 'hsl(var(--sc-card))',
          stroke: 'hsl(var(--sc-border))',
          rx: 8,
          ry: 8,
        },
        text: { fill: 'hsl(var(--sc-fg))' },
      },
    },
    BackstageDependencyGraphDefaultLabel: {
      styleOverrides: { text: { fill: 'hsl(var(--sc-fg))' } },
    },
    BackstageDependencyGraphEdge: {
      styleOverrides: { path: { stroke: 'hsl(var(--sc-border) / .55)' } },
    },
};

function makeTheme(mode: 'light' | 'dark', t: Tone) {
  const base = mode === 'light' ? palettes.light : palettes.dark;
  // Backstage's own components are styled here, through their published
  // override keys and slot names, rather than by matching hashed class
  // prefixes from injected CSS. The slots are typed by @backstage/core-components
  // (HeaderClassKey, InfoCardClassKey, …), so a renamed slot fails tsc instead
  // of silently rendering unstyled.
  //
  // Kept as an untyped local rather than inlined, because BackstageAutocomplete
  // below isn't a known key (it ships from @backstage/plugin-catalog-react, not
  // core-components) — inlined into the createUnifiedTheme() call it would hit
  // TS2353 (excess property) since that check only fires on fresh object
  // literals; passed in by reference it's a normal structural assignment,
  // which permits the extra key.
  const componentOverrides = {
    // The app visualizer still renders Backstage's SVG DependencyGraph — it is
    // a different feature from the catalog graph, and these four keys are what
    // keep it on the platform's palette. They were deleted with the catalog
    // graph's overrides and left the visualizer unstyled: a transparent canvas
    // with default light-blue nodes on a dark page.
    ...GRAPH_OVERRIDES,
    BackstageHeader: {
        styleOverrides: {
          header: {
            // The hook a mode potion fills; `none` keeps every other scheme
            // byte-identical. A CSS selector cannot reach this element —
            // BackstageHeader-* becomes jss<n> in a production build.
            backgroundImage: 'var(--sc-header-art, none)',
            // The band needs more than an image to be a band: a repeating
            // ornament has to be sized, tiled on one axis and pinned to an
            // edge. Four hooks rather than one, each inert by default so every
            // other scheme renders exactly as it did before.
            backgroundSize: 'var(--sc-header-art-size, auto)',
            backgroundRepeat: 'var(--sc-header-art-repeat, repeat)',
            backgroundPosition: 'var(--sc-header-art-pos, 0 0)',
            backgroundColor: 'hsl(var(--sc-card))',
            boxShadow: 'none',
            borderBottom: '1px solid hsl(var(--sc-border))',
            paddingTop: 16,
            paddingBottom: 14,
            minHeight: 0,
          },
          title: {
            color: 'hsl(var(--sc-fg))',
            fontFamily: 'var(--sc-font-title) !important',
            textTransform: 'uppercase',
            fontWeight: 400,
            // 18px/1.35 was a separate class*="BackstageContentHeader-title"
            // rule in styles.ts, folded in here — same slot, same production
            // build hazard as the caret below.
            fontSize: '18px !important',
            lineHeight: '1.35 !important',
            // The block caret (see .sc-h1::after in styles.ts for the sibling
            // selectors this can't share, since a hashed class fragment
            // doesn't survive a production build).
            '&::after': {
              content: "'\\258C' / ''",
              marginLeft: 4,
              color: 'hsl(var(--sc-primary))',
            },
            '@media (prefers-reduced-motion: no-preference)': {
              '&::after': {
                animation: 'sc-caret 1s steps(1) infinite',
              },
            },
          },
          subtitle: { color: 'hsl(var(--sc-muted-fg))' },
          type: { color: 'hsl(var(--sc-muted-fg))' },
        },
      },
      BackstageHeaderLabel: {
        styleOverrides: { label: { color: 'hsl(var(--sc-muted-fg))' } },
      },
      BackstageContent: {
        styleOverrides: {
          root: { background: 'hsl(var(--sc-bg))' },
        },
      },
      BackstageContentHeader: {
        styleOverrides: {
          title: {
            fontFamily: 'var(--sc-font-ui) !important',
            textTransform: 'uppercase !important',
            letterSpacing: '0 !important',
            fontWeight: '400 !important',
          },
        },
      },
      BackstageInfoCard: {
        styleOverrides: {
          header: {
            backgroundColor: 'hsl(var(--sc-card))',
            color: 'hsl(var(--sc-fg))',
            borderBottom: '1px solid hsl(var(--sc-border))',
            '& *': { fontSize: '19px !important' },
          },
        },
      },
      BackstageItemCardHeader: {
        styleOverrides: {
          // No title/subtitle slot: the title is a plain Typography child, so
          // font/text-transform on root reaches it by inheritance. The
          // pixel-art background gradient stays in styles.ts (CSS is simpler
          // than a style object for that part), keyed off a stable class.
          root: {
            fontFamily: 'var(--sc-font-ui) !important',
            textTransform: 'uppercase !important',
            letterSpacing: '0 !important',
            fontWeight: '400 !important',
          },
        },
      },
      // BackstageAutocomplete isn't part of BackstageComponentsNameToClassKey
      // (it ships from @backstage/plugin-catalog-react, not core-components) —
      // see the comment on componentOverrides above for how this avoids TS2353.
      BackstageAutocomplete: {
        styleOverrides: {
          label: {
            fontFamily: 'var(--sc-font-ui) !important',
            textTransform: 'uppercase !important',
            letterSpacing: '0 !important',
            fontWeight: '400 !important',
          },
        },
      },
      // Input geometry lives here, not in styles.ts: MUI publishes these slots,
      // and createUnifiedTheme runs transformV5ComponentThemesToV4 over every
      // Mui* key, so a v5-shaped override reaches the MUI v4 scaffolder form.
      // The outlined/notchedOutline corrections below are app-wide on purpose
      // (slot-scoped, not route-scoped) — that is what makes them cover
      // EntityPicker/OwnedEntityPicker/RepoUrlPicker wherever a template uses
      // one, not just on the create route.
      MuiInputLabel: {
        styleOverrides: {
          // `formControl` is NOT the standard variant only: MUI v4 puts that
          // class on every label inside a FormControl, so an outlined label
          // carries both formControl and outlined. What separates them is
          // cascade order — MUI declares `outlined` after `formControl` in its
          // own styles object, that key order survives the theme merge, and at
          // equal specificity the later rule wins. Hence the explicit reset in
          // the outlined slot below.
          //
          // The `var(--sc-field-x)` inset itself is nested under
          // `.sc-route-create &`, not applied bare: it exists only to align
          // with the boxed standard-variant field
          // (`.sc-route-create [class*="MuiInput-root"]` in styles.ts, padding
          // `3px var(--sc-field-x)`) that exists on the scaffolder create route
          // and nowhere else. Applied bare it shifted every standard MUI label
          // in the app — catalog filters, the import page, table pagination —
          // by 10px, none of which was ever measured against this box.
          formControl: {
            // Standard-variant labels only. The :not() pair is load-bearing:
            // this selector is (0,2,0) and the `outlined` reset below is
            // (0,1,0), so without them the inset wins on the create route and
            // an outlined label sits 10px right of the notch that was cut for
            // it. Matched by substring because MUI v4 suffixes its class names
            // (MuiInputLabel-outlined-234), the same reason styles.ts uses
            // [class*=] throughout.
            '.sc-route-create &:not([class*="MuiInputLabel-outlined"]):not([class*="MuiInputLabel-filled"])':
              {
                left: 'var(--sc-field-x)',
              },
          },
          shrink: {
            paddingInlineEnd: '4px',
          },
          outlined: {
            // left: 0 is load-bearing, not redundant. It cancels the
            // .sc-route-create standard-variant inset that formControl above
            // also applies to this label there; delete it and the label
            // desyncs from its <legend> notch again on that route, which is
            // the exact bug this block exists to fix. The shrunk state then
            // gets one more pixel of clearance than MUI's -6px, which assumes
            // a 1px border where ours is 2px. This correction stays app-wide
            // — it is corrective (undoing the create-route inset), not
            // decorative, so every outlined label needs it, not just create's.
            left: '0',
            '&.MuiInputLabel-shrink': {
              paddingInlineEnd: '0',
              transform: 'translate(14px, -7px) scale(0.75)',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: {
            // The label is uppercased (styles.ts) but the <legend> MUI generates
            // from the raw title is not, so the notch was cut too narrow for the
            // text sitting in it.
            // MUI already sizes the notch to the label: legendLabelled is
            // width:auto at fontSize .75em, matching the label's scale(.75)
            // (NotchedOutline.js). It only fits if the legend renders the same
            // string with the same metrics — so every property styles.ts forces
            // on the label has to be mirrored here, or the two measure
            // differently and the error grows with the title's length.
            '& legend': {
              textTransform: 'uppercase',
              fontFamily: 'var(--sc-font-ui)',
              letterSpacing: 0,
              fontWeight: 400,
            },
          },
        },
      },
      BackstageSidebarPage: {
        styleOverrides: {
          root: {
            // !important is load-bearing here: SidebarPage sets its own
            // padding-left (224px, its default sidebar width) inside a
            // breakpoint, which otherwise wins and misaligns the content
            // against our 240px nav.
            paddingLeft: 'var(--sc-nav-w) !important',
            transition: 'padding-left .16s ease',
            '@media (max-width: 600px)': {
              paddingLeft: '0 !important',
            },
          },
        },
      },
  };
  return createUnifiedTheme({
    fontFamily: FONT,
    palette: {
      ...base,
      primary: { main: t.primary },
      secondary: { main: ACCENT },
      background: { default: t.bg, paper: t.surface },
      navigation: {
        ...base.navigation,
        background: t.navBg,
        indicator: t.primary,
        color: mode === 'light' ? '#4b5563' : '#c9c5d8',
        selectedColor: t.primary,
        navItem: { hoverBackground: mode === 'light' ? '#f1f1f4' : '#201d29' },
      },
    },
    pageTheme: pageThemes,
    components: componentOverrides,
    typography: {
      fontFamily: FONT,
      h1: { fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      button: { textTransform: 'none' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
}

/**
 * Exported for theme.test.ts only. Input geometry lives in these override keys
 * rather than in styles.ts (design-system.md), and a selector here that never
 * matches fails silently — no test rendered this file before, which is how a
 * label sat 10px outside its own notch on a shipped build.
 */
export const platformLight = makeTheme('light', LIGHT);
const platformDark = makeTheme('dark', DARK);

function themeExt(id: string, title: string, variant: 'light' | 'dark', theme: unknown) {
  return ThemeBlueprint.make({
    name: id,
    params: {
      theme: {
        id,
        title,
        variant,
        icon: variant === 'light' ? <LightIcon /> : <DarkIcon />,
        Provider: ({ children }: { children: ReactNode }) => (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <UnifiedThemeProvider theme={theme as any}>
            {children}
          </UnifiedThemeProvider>
        ),
      },
    },
  });
}

const lightTheme = themeExt('platform-light', 'Platform Light', 'light', platformLight);
const darkTheme = themeExt('platform-dark', 'Platform Dark', 'dark', platformDark);

const schemeRoot = AppRootElementBlueprint.make({
  name: 'scheme-root',
  params: { element: <SchemeRoot /> },
});

// Replaces the request form with the maintenance page for non-admins while
// maintenance mode is on (see MaintenanceGate.tsx).
const maintenanceGate = AppRootWrapperBlueprint.make({
  name: 'maintenance-gate',
  params: {
    component: ({ children }) => <MaintenanceGate>{children}</MaintenanceGate>,
  },
});

/**
 * The single platform-ui plugin feature: the shadcn theme (light/dark), the
 * global shadcn CSS + color picker (SchemeRoot), and the custom shadcn nav.
 * Add this one entry to the app's `features`.
 */
/**
 * Our catalog graph, replacing the built-in one at the same path.
 *
 * The path must stay /catalog-graph: the relations card links there, and
 * CustomNav hides that exact href from the sidebar — registering anything else
 * would silently un-hide it.
 */
const catalogGraphPage = PageBlueprint.make({
  name: 'catalog-graph',
  params: {
    path: '/catalog-graph',
    loader: () =>
      import('./CatalogGraphPage').then(m => <m.CatalogGraphPage />),
  },
});

export const platformUiModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    lightTheme,
    darkTheme,
    schemeRoot,
    maintenanceGate,
    navContent,
    catalogGraphPage,
  ],
});
