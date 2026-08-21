/**
 * tokens.ts
 * -----------------------------------------------------------------------
 * Design tokens for the "clinical precision" visual direction:
 * a deep slate-blue navigation surface, a teal accent reserved for
 * positive financial signals (profit, acceptance, "on target"), and a
 * restrained amber/red pair for the alert system's Yellow/Red states —
 * deliberately not reused anywhere else, so alert color always means
 * alert. Data-heavy tables use tabular figures (IBM Plex Mono) so costs
 * align on the decimal point at a glance.
 * -----------------------------------------------------------------------
 */

export const palette = {
  // Brand / navigation
  slate900: '#0B1220',
  slate800: '#131B2E',
  slate700: '#1E3A5F',
  slate600: '#2C4A73',
  slate500: '#5B7699',

  // Accent (positive / brand)
  teal600: '#0F9D8C',
  teal500: '#14B8A6',
  teal100: '#D5F3EF',

  // Alert system — reserved exclusively for alert severity
  green600: '#2E7D32',
  green100: '#E3F3E4',
  amber600: '#B7791F',
  amber500: '#F5A623',
  amber100: '#FCF0D9',
  red600: '#C0392B',
  red500: '#D64545',
  red100: '#FAE1DE',

  // Neutrals — light mode
  bgLight: '#F5F7FA',
  surfaceLight: '#FFFFFF',
  surfaceMutedLight: '#EEF2F6',
  textPrimaryLight: '#16202A',
  textSecondaryLight: '#5B6B7C',
  borderLight: '#E1E7ED',

  // Neutrals — dark mode
  bgDark: '#0B1220',
  surfaceDark: '#131B2E',
  surfaceMutedDark: '#192339',
  textPrimaryDark: '#E6EBF2',
  textSecondaryDark: '#93A2B5',
  borderDark: '#243349',
};

export const typography = {
  display: '"Sora", "Inter", sans-serif',
  body: '"Inter", "Sora", sans-serif',
  mono: '"IBM Plex Mono", "Roboto Mono", monospace',
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
};

export const severityColor = {
  GREEN: { main: palette.green600, bg: palette.green100 },
  YELLOW: { main: palette.amber600, bg: palette.amber100 },
  RED: { main: palette.red600, bg: palette.red100 },
} as const;

export const statusColor: Record<string, { main: string; bg: string }> = {
  DRAFT:                    { main: '#5B6B7C', bg: '#EEF2F6' },
  PLANNED:                  { main: '#1565C0', bg: '#E3F2FD' },
  SENT_FOR_BUDGET_APPROVAL: { main: '#8A6D3B', bg: '#FCF0D9' },
  BUDGET_APPROVED:          { main: '#2E7D32', bg: '#E8F5E9' },
  REVISE_BUDGET:            { main: '#B7791F', bg: '#FFF8E1' },
  SCHEDULED:                { main: '#1E3A5F', bg: '#DCE6F2' },
  RESCHEDULED:              { main: '#6A1B9A', bg: '#F3E5F5' },
  POSTPONED:                { main: '#E65100', bg: '#FBE9E7' },
  SURGERY_COMPLETED:        { main: '#0F9D8C', bg: '#D5F3EF' },
  PARTIALLY_RECONCILED:     { main: '#00838F', bg: '#E0F7FA' },
  FULLY_RECONCILED:         { main: '#2E7D32', bg: '#E3F3E4' },
  CLOSED:                   { main: '#37474F', bg: '#ECEFF1' },
  CANCELLED:                { main: '#8A8F98', bg: '#EDEEF0' },
  // OT Schedule statuses
  CONFIRMED:                { main: '#1B5E20', bg: '#E8F5E9' },
  // Legacy
  PENDING:                  { main: '#8A6D3B', bg: '#FCF0D9' },
  IN_PROGRESS:              { main: '#0F9D8C', bg: '#D5F3EF' },
  COMPLETED:                { main: '#2E7D32', bg: '#E3F3E4' },
  DELETED:                  { main: '#C0392B', bg: '#FAE1DE' },
};
