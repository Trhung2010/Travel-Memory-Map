export const C = {
  // Base backgrounds (Deep Space OLED)
  bg: '#070A11',
  bgSecondary: '#0B111D',
  surface: '#111927',
  elevated: '#172235',

  // Glassmorphic tokens
  glass: 'rgba(255, 255, 255, 0.05)',
  glassCard: 'rgba(17, 25, 39, 0.72)',
  glassElevated: 'rgba(23, 34, 53, 0.82)',
  glassBorder: 'rgba(255, 255, 255, 0.09)',
  glassBorderHighlight: 'rgba(255, 255, 255, 0.18)',
  glassBorderAccent: 'rgba(255, 179, 64, 0.35)',
  glassPill: 'rgba(255, 255, 255, 0.07)',
  glassPillActive: 'rgba(255, 179, 64, 0.18)',

  // Text tokens
  white: '#FFFFFF',
  text: '#F8FAFC',
  muted: '#94A3B8',
  dim: '#64748B',
  subtle: '#334155',

  // Accent & Action colors (iOS & Luxury Gold)
  accent: '#FFB340',        // Sunrise Gold
  accent2: '#FFA114',       // Deep Amber
  accentGlow: 'rgba(255, 179, 64, 0.28)',
  cyan: '#64D2FF',          // iOS Cyan
  blue: '#0A84FF',          // Apple System Blue
  green: '#30D158',         // iOS Mint/Emerald
  purple: '#BF5AF2',        // iOS Violet
  danger: '#FF453A',        // iOS Coral Red
  dangerGlass: 'rgba(255, 69, 58, 0.18)',

  border: '#1E2B3E',
} as const;

export const GRADIENTS = {
  background: ['#0C1322', '#070A11', '#04060A'] as const,
  hero: ['#1A324E', '#102033', '#0B1624'] as const,
  heroGlow: ['#234164', '#15293F', '#0E1C2B'] as const,
  accent: ['#FFC46A', '#FF9F1C'] as const,
  accentSoft: ['rgba(255, 179, 64, 0.22)', 'rgba(255, 159, 28, 0.08)'] as const,
  cyan: ['#64D2FF', '#0A84FF'] as const,
  green: ['#34D399', '#059669'] as const,
  dock: ['rgba(13, 20, 33, 0.88)', 'rgba(8, 12, 20, 0.94)'] as const,
  cardOverlay: ['rgba(0,0,0,0)', 'rgba(7,10,17,0.7)', '#070A11'] as const,
} as const;
