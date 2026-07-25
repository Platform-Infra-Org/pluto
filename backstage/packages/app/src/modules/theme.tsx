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

// Approximates the legacy shadcn/Tailwind look: an indigo/violet primary with a
// warm accent, on the Backstage unified theme (MUI). Light + dark variants.
const PRIMARY = '#6366f1'; // indigo-500
const ACCENT = '#8b5cf6'; // violet-500

// Indigo→violet page banners so headers carry the platform identity (replacing
// the stock teal). One gradient reused across all page categories.
const pageThemes = {
  home: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  documentation: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave2 }),
  tool: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.round }),
  service: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  other: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  app: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
  apis: genPageTheme({ colors: [PRIMARY, ACCENT], shape: shapes.wave }),
};

const platformLight = createUnifiedTheme({
  palette: {
    ...palettes.light,
    primary: { main: PRIMARY },
    secondary: { main: ACCENT },
    navigation: {
      ...palettes.light.navigation,
      background: '#1e1b2e',
      indicator: PRIMARY,
      color: '#d7d3e8',
      selectedColor: '#ffffff',
      navItem: { hoverBackground: '#2a2540' },
    },
  },
  pageTheme: pageThemes,
});

const platformDark = createUnifiedTheme({
  palette: {
    ...palettes.dark,
    primary: { main: '#818cf8' }, // indigo-400 reads better on dark
    secondary: { main: ACCENT },
    navigation: {
      ...palettes.dark.navigation,
      background: '#17151f',
      indicator: '#818cf8',
      color: '#c9c5d8',
      selectedColor: '#ffffff',
      navItem: { hoverBackground: '#221f2e' },
    },
  },
  pageTheme: pageThemes,
});

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
