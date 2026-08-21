import { createTheme, type ThemeOptions } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';
import { palette, typography, radii } from './tokens';

function buildThemeOptions(mode: PaletteMode): ThemeOptions {
  const isDark = mode === 'dark';

  return {
    palette: {
      mode,
      primary: { main: isDark ? palette.teal500 : palette.slate700, contrastText: '#fff' },
      secondary: { main: palette.teal600, contrastText: '#fff' },
      success: { main: palette.green600 },
      warning: { main: palette.amber600 },
      error: { main: palette.red600 },
      background: {
        default: isDark ? palette.bgDark : palette.bgLight,
        paper: isDark ? palette.surfaceDark : palette.surfaceLight,
      },
      text: {
        primary: isDark ? palette.textPrimaryDark : palette.textPrimaryLight,
        secondary: isDark ? palette.textSecondaryDark : palette.textSecondaryLight,
      },
      divider: isDark ? palette.borderDark : palette.borderLight,
      action: {
        hover: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        selected: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        disabled: isDark ? 'rgba(255, 255, 255, 0.26)' : 'rgba(0, 0, 0, 0.26)',
        disabledBackground: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
        focus: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      },
    },
    shape: { borderRadius: radii.md },
    typography: {
      fontFamily: typography.body,
      h1: { fontFamily: typography.display, fontWeight: 700 },
      h2: { fontFamily: typography.display, fontWeight: 700 },
      h3: { fontFamily: typography.display, fontWeight: 600 },
      h4: { fontFamily: typography.display, fontWeight: 600 },
      h5: { fontFamily: typography.display, fontWeight: 600 },
      h6: { fontFamily: typography.display, fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDark ? `${palette.slate600} ${palette.slate800}` : undefined,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? palette.borderDark : palette.borderLight}`,
            boxShadow: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: radii.sm },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: { fontWeight: 700, fontSize: '0.75rem', letterSpacing: 0.4, textTransform: 'uppercase' },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? palette.surfaceDark : palette.surfaceLight,
            border: `1px solid ${isDark ? palette.borderDark : palette.borderLight}`,
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.6)'
              : '0 8px 32px rgba(0,0,0,0.12)',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(20,184,166,0.15)' : 'rgba(30,58,95,0.08)',
            },
            '&.Mui-selected:hover': {
              backgroundColor: isDark ? 'rgba(20,184,166,0.22)' : 'rgba(30,58,95,0.12)',
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            color: isDark ? palette.textSecondaryDark : palette.textSecondaryLight,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& fieldset': {
              borderColor: isDark ? palette.borderDark : palette.borderLight,
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? palette.surfaceDark : palette.surfaceLight,
            color: isDark ? palette.textPrimaryDark : palette.textPrimaryLight,
          },
        },
      },
    },
  };
}

export const lightTheme = createTheme(buildThemeOptions('light'));
export const darkTheme = createTheme(buildThemeOptions('dark'));
