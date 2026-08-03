import { ReactNode } from 'react';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
import {
  AppRootElementBlueprint,
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
const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

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
    // Backstage's own components are styled here, through their published
    // override keys and slot names, rather than by matching hashed class
    // prefixes from injected CSS. The slots are typed by @backstage/core-components
    // (HeaderClassKey, InfoCardClassKey, …), so a renamed slot fails tsc instead
    // of silently rendering unstyled.
    components: {
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
            fontSize: '1.6rem',
            lineHeight: 1.2,
          },
          subtitle: { color: 'hsl(var(--sc-muted-fg))' },
          type: { color: 'hsl(var(--sc-muted-fg))' },
        },
      },
      BackstageHeaderLabel: {
        styleOverrides: { label: { color: 'hsl(var(--sc-muted-fg))' } },
      },
      BackstageInfoCard: {
        styleOverrides: {
          header: {
            backgroundColor: 'hsl(var(--sc-card))',
            color: 'hsl(var(--sc-fg))',
            borderBottom: '1px solid hsl(var(--sc-border))',
          },
        },
      },
      BackstageItemCardHeader: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            background: 'hsl(var(--sc-muted))',
            color: 'hsl(var(--sc-fg))',
            borderBottom: '1px solid hsl(var(--sc-border))',
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
          },
        },
      },
    },
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
export const platformUiModule = createFrontendModule({
  pluginId: 'app',
  extensions: [lightTheme, darkTheme, schemeRoot, navContent],
});
