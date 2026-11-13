// Colours for the whole app: soft and light, after Cal AI and BitePal on Mobbin.

export const T = {
  background: ['#F6F7F9', '#EEF0F4'] as const,
  card: '#FFFFFF',
  cardShadow: { shadowColor: '#1B2340', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  text: '#0F1115',
  muted: '#6B7280',
  faint: '#A3A9B5',
  track: '#EDEFF3',
  primary: '#0F1115',
  onPrimary: '#FFFFFF',
  record: '#FF3B30',
  ring: {
    good: ['#22C55E', '#10B9A8'] as const,
    fair: ['#F59E0B', '#F97316'] as const,
    poor: ['#F43F5E', '#EF4444'] as const,
  },
};
