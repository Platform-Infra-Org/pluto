import { ThemeBlueprint } from '@backstage/plugin-app-react';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  createUnifiedTheme,
  genPageTheme,
  palettes,
  shapes,
  UnifiedThemeProvider,
} from '@backstage/theme';
import LightIcon from '@material-ui/icons/WbSunny';
import DarkIcon from '@material-ui/icons/Brightness2';

// A deliberately modern, shadcn-flavored take on the Backstage MUI theme:
// indigo primary, flat bordered surfaces, no ALL-CAPS buttons, quiet tables,
// and a flattened header (no wave banner). Light + dark variants.
const PRIMARY = '#6366f1'; // indigo-500
const PRIMARY_DARK = '#818cf8'; // indigo-400 (reads better on dark)
const ACCENT = '#8b5cf6'; // violet-500

const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

type Tone = {
  primary: string;
  bg: string;
  surface: string;
  border: string;
  fg: string;
  muted: string;
  navBg: string;
};

const LIGHT: Tone = {
  primary: PRIMARY,
  bg: '#f6f6f8',
  surface: '#ffffff',
  border: '#e6e6ec',
  fg: '#1b1b2b',
  muted: '#6b7280',
  navBg: '#17151f',
};
const DARK: Tone = {
  primary: PRIMARY_DARK,
  bg: '#0f0e15',
  surface: '#17151f',
  border: '#2a2733',
  fg: '#ededf2',
  muted: '#9a96a8',
  navBg: '#131118',
};

// Subtle indigo page banner used only as a thin accent (headers are flattened
// via BackstageHeader overrides, so this mostly affects small accents).
const pageThemes = {
  home: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  documentation: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave2 }),
  tool: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.round }),
  service: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  other: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  app: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  apis: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
};

function components(t: Tone) {
  return {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: t.bg } },
    },
    // Flatten the header: drop the wave/gradient, use the page surface with a
    // hairline divider and dark title — the biggest "stock Backstage" tell.
    BackstageHeader: {
      styleOverrides: {
        header: {
          backgroundImage: 'none',
          backgroundColor: t.surface,
          boxShadow: 'none',
          borderBottom: `1px solid ${t.border}`,
          paddingBottom: 20,
        },
        title: { color: t.fg, fontWeight: 700, letterSpacing: '-0.02em' },
        subtitle: { color: t.muted },
        type: { color: t.muted },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          borderRadius: 8,
          fontWeight: 600,
          boxShadow: 'none',
        },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        outlined: { borderColor: t.border },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 12 },
        elevation1: { boxShadow: 'none', border: `1px solid ${t.border}` },
        elevation2: { boxShadow: 'none', border: `1px solid ${t.border}` },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          textTransform: 'uppercase' as const,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: t.muted,
          borderColor: t.border,
        },
        root: { borderColor: t.border },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 },
        notchedOutline: { borderColor: t.border },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 6, fontWeight: 600 } } },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none' as const, fontWeight: 600 } },
    },
  };
}

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
        color: '#c9c5d8',
        selectedColor: '#ffffff',
        navItem: { hoverBackground: mode === 'light' ? '#241f33' : '#201d29' },
      },
    },
    pageTheme: pageThemes,
    components: components(t),
    typography: {
      fontFamily: FONT,
      h1: { fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      button: { textTransform: 'none' },
    } as any,
  });
}

const platformLight = makeTheme('light', LIGHT);
const platformDark = makeTheme('dark', DARK);

const lightTheme = ThemeBlueprint.make({
  name: 'platform-light',
  params: {
    theme: {
      id: 'platform-light',
      title: 'Platform Light',
      variant: 'light',
      icon: <LightIcon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={platformLight}>
          {children}
        </UnifiedThemeProvider>
      ),
    },
  },
});

const darkTheme = ThemeBlueprint.make({
  name: 'platform-dark',
  params: {
    theme: {
      id: 'platform-dark',
      title: 'Platform Dark',
      variant: 'dark',
      icon: <DarkIcon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={platformDark}>
          {children}
        </UnifiedThemeProvider>
      ),
    },
  },
});

export const themeModule = createFrontendModule({
  pluginId: 'app',
  extensions: [lightTheme, darkTheme],
});
