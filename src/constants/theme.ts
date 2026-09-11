// Discord-Themed Design System & Color Tokens for ScanFinance

export const Palette = {
  // Discord Iconic Blurple
  primary: '#5865F2',
  primaryLight: '#7983F5',
  primaryDark: '#4752C4',
  primaryMuted: 'rgba(88, 101, 242, 0.15)',

  // Discord Status & Semantic Colors
  secondary: '#5865F2',
  greenOnline: '#23A55A',
  amberIdle: '#F0B232',
  coralDnd: '#F23F43',
  indigo: '#5865F2',
  coral: '#F23F43',
  amber: '#F0B232',
  cyan: '#00A8FC',
  purple: '#9B59B6',

  // Discord Dark Theme Neutral Shades
  discordBg: '#1E1F22',          // Main Background
  discordChannelBg: '#2B2D31',    // Card / Channel / Panel Background
  discordInputBg: '#383A40',      // Input & Active Element Background
  discordHoverBg: '#35373C',      // Hover / Elevated Item Background
  discordHeaderBg: '#111214',     // Navigation & Header Background
  discordBorder: 'rgba(255, 255, 255, 0.07)',
  discordBorderHighlight: 'rgba(88, 101, 242, 0.4)',

  // Discord Typography Colors
  discordText: '#F2F3F5',         // Primary White Text
  discordTextSecondary: '#DBDEE1',// Secondary Text
  discordTextMuted: '#949BA4',    // Muted / Timestamp / Placeholder Text
  discordTextDarker: '#6D6F78',

  // Legacy mappings for backwards-compatibility across components
  darkBg: '#1E1F22',
  darkCard: '#2B2D31',
  darkCardHover: '#35373C',
  darkBorder: 'rgba(255, 255, 255, 0.07)',
  darkBorderHighlight: 'rgba(88, 101, 242, 0.4)',
  darkText: '#F2F3F5',
  darkTextSecondary: '#DBDEE1',
  darkTextMuted: '#949BA4',
};

export const Colors = {
  dark: {
    background: Palette.discordBg,
    card: Palette.discordChannelBg,
    cardHover: Palette.discordHoverBg,
    border: Palette.discordBorder,
    borderHighlight: Palette.discordBorderHighlight,
    text: Palette.discordText,
    textSecondary: Palette.discordTextSecondary,
    textMuted: Palette.discordTextMuted,
    primary: Palette.primary,
    primaryLight: Palette.primaryLight,
    primaryMuted: Palette.primaryMuted,
    secondary: Palette.secondary,
    danger: Palette.coralDnd,
    warning: Palette.amberIdle,
    success: Palette.greenOnline,
    tabBar: Palette.discordHeaderBg,
    tabBarBorder: Palette.discordBorder,
  },
  light: {
    background: '#F2F3F5',
    card: '#FFFFFF',
    cardHover: '#E3E5E8',
    border: 'rgba(0, 0, 0, 0.08)',
    borderHighlight: Palette.primary,
    text: '#060607',
    textSecondary: '#4E5058',
    textMuted: '#80848E',
    primary: Palette.primary,
    primaryLight: Palette.primaryDark,
    primaryMuted: Palette.primaryMuted,
    secondary: Palette.secondary,
    danger: Palette.coralDnd,
    warning: Palette.amberIdle,
    success: Palette.greenOnline,
    tabBar: '#FFFFFF',
    tabBarBorder: 'rgba(0, 0, 0, 0.08)',
  },
};
