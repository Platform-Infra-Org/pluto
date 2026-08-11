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
const FONT = "'Pixelify Sans', ui-monospace, SFMono-Regular, monospace";

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

const pageThemes = {
  home: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  documentation: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave2 }),
  tool: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.round }),
  service: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  other: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  app: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  apis: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
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
    BackstageHeader: {
        styleOverrides: {
          header: {
            backgroundImage: 'none',
            backgroundColor: 'hsl(var(--sc-card))',
            boxShadow: 'none',
            borderBottom: '1px solid hsl(var(--sc-border))',
            paddingTop: 16,
            paddingBottom: 14,
            minHeight: 0,
          },
          title: {
            color: 'hsl(var(--sc-fg))',
            fontFamily: "'Pixelify Sans', ui-monospace, monospace",
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
              content: "'\\2588' / ''",
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
            fontFamily: 'var(--sc-font-pixel) !important',
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
            fontFamily: 'var(--sc-font-pixel) !important',
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
            fontFamily: 'var(--sc-font-pixel) !important',
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
