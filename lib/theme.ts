export const theme = {
  colors: {
    bg: '#000000',
    surface: '#0a0a0f',
    card: '#121214',
    cardHover: '#18181c',
    border: '#1c1c20',
    borderLight: 'rgba(255,255,255,0.06)',
    accent: '#a78bfa',
    accentGlow: 'rgba(167, 139, 250, 0.25)',
    accentMuted: 'rgba(167, 139, 250, 0.10)',
    cyan: '#22d3ee',
    cyanGlow: 'rgba(34, 211, 238, 0.20)',
    text: {
      primary: '#fafafa',
      secondary: '#a0a0a8',
      muted: '#585860',
      inverse: '#000000',
    },
    success: '#34d399',
    successMuted: 'rgba(52, 211, 153, 0.12)',
    danger: '#f87171',
    dangerMuted: 'rgba(248, 113, 113, 0.12)',
    warning: '#fbbf24',
    warningMuted: 'rgba(251, 191, 36, 0.12)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    xxl: 40,
  },

  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
    full: 9999,
  },

  typography: {
    caption: { fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const },
    body: { fontSize: 15, fontWeight: '500' as const },
    bodyBold: { fontSize: 15, fontWeight: '600' as const },
    title: { fontSize: 20, fontWeight: '700' as const },
    hero: { fontSize: 28, fontWeight: '700' as const },
    mono: { fontSize: 14, fontWeight: '500' as const, fontFamily: 'monospace' as const },
  },

  shadows: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    fab: {
      shadowColor: '#a78bfa',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 10,
    },
    glow: {
      shadowColor: '#a78bfa',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
  },

  animation: {
    spring: { stiffness: 200, damping: 20, mass: 0.8 },
    gentle: { stiffness: 120, damping: 14, mass: 1 },
  },
} as const;
