// Design System & Theme Tokens for ScanFinance

export const Palette = {
  // Emerald / Mint primary brand colors
  primary: '#10B981',
  primaryLight: '#34D399',
  primaryDark: '#059669',
  primaryMuted: 'rgba(16, 185, 129, 0.12)',

  // Secondary accents
  indigo: '#6366F1',
  indigoLight: '#818CF8',
  indigoMuted: 'rgba(99, 102, 241, 0.12)',

  coral: '#F43F5E',
  coralLight: '#FB7185',
  coralMuted: 'rgba(244, 63, 94, 0.12)',

  amber: '#F59E0B',
  amberLight: '#FBBF24',
  amberMuted: 'rgba(245, 158, 11, 0.12)',

  cyan: '#06B6D4',
  purple: '#8B5CF6',

  // Dark Theme Neutral Shades
  darkBg: '#090D16',
  darkCard: '#111827',
  darkCardHover: '#1F2937',
  darkBorder: 'rgba(255, 255, 255, 0.08)',
  darkBorderHighlight: 'rgba(16, 185, 129, 0.3)',
  darkText: '#F9FAFB',
  darkTextSecondary: '#9CA3AF',
  darkTextMuted: '#6B7280',

  // Light Theme Neutral Shades
  lightBg: '#F8FAFC',
  lightCard: '#FFFFFF',
  lightCardHover: '#F1F5F9',
  lightBorder: 'rgba(0, 0, 0, 0.06)',
  lightBorderHighlight: 'rgba(16, 185, 129, 0.4)',
  lightText: '#0F172A',
  lightTextSecondary: '#475569',
  lightTextMuted: '#94A3B8',
};

export const Colors = {
  dark: {
    background: Palette.darkBg,
    card: Palette.darkCard,
    cardHover: Palette.darkCardHover,
    border: Palette.darkBorder,
    borderHighlight: Palette.darkBorderHighlight,
    text: Palette.darkText,
    textSecondary: Palette.darkTextSecondary,
    textMuted: Palette.darkTextMuted,
    primary: Palette.primary,
    primaryLight: Palette.primaryLight,
    primaryMuted: Palette.primaryMuted,
    secondary: Palette.indigo,
    danger: Palette.coral,
    warning: Palette.amber,
    success: Palette.primary,
    tabBar: '#0D1322',
    tabBarBorder: 'rgba(255, 255, 255, 0.06)',
  },
  light: {
    background: Palette.lightBg,
    card: Palette.lightCard,
    cardHover: Palette.lightCardHover,
    border: Palette.lightBorder,
    borderHighlight: Palette.lightBorderHighlight,
    text: Palette.lightText,
    textSecondary: Palette.lightTextSecondary,
    textMuted: Palette.lightTextMuted,
    primary: Palette.primary,
    primaryLight: Palette.primaryDark,
    primaryMuted: Palette.primaryMuted,
    secondary: Palette.indigo,
    danger: Palette.coral,
    warning: Palette.amber,
    success: Palette.primary,
    tabBar: '#FFFFFF',
    tabBarBorder: 'rgba(0, 0, 0, 0.06)',
  },
};
