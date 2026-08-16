import { ReactNode } from 'react';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
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

const platformLight = makeTheme('light', LIGHT);
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
  extensions: [lightTheme, darkTheme, schemeRoot, navContent, catalogGraphPage],
});
