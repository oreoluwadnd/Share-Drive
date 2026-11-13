// Colours for the whole app. Two directions to choose from; the app uses T.

type Theme = {
  background: readonly [string, string, ...string[]];
  card: string;
  cardBorder: string;
  cardShadow: object;
  text: string;
  muted: string;
  faint: string;
  track: string;
  primary: string;
  onPrimary: string;
  record: string;
  ring: Record<'good' | 'fair' | 'poor', readonly [string, string]>;
  statusBar: 'light' | 'dark';
};

// A: soft and light, like Cal AI and BitePal.
export const LIGHT: Theme = {
  background: ['#F6F7F9', '#EEF0F4'],
  card: '#FFFFFF',
  cardBorder: '#FFFFFF',
  cardShadow: { shadowColor: '#1B2340', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  text: '#0F1115',
  muted: '#6B7280',
  faint: '#A3A9B5',
  track: '#EDEFF3',
  primary: '#0F1115',
  onPrimary: '#FFFFFF',
  record: '#FF3B30',
  ring: { good: ['#22C55E', '#10B9A8'], fair: ['#F59E0B', '#F97316'], poor: ['#F43F5E', '#EF4444'] },
  statusBar: 'dark',
};

// B: bold and vivid, like Sweatcoin.
export const VIVID: Theme = {
  background: ['#2A1B8F', '#5B2FD6', '#7C3AED'],
  card: 'rgba(255,255,255,0.12)',
  cardBorder: 'rgba(255,255,255,0.18)',
  cardShadow: {},
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.72)',
  faint: 'rgba(255,255,255,0.45)',
  track: 'rgba(255,255,255,0.16)',
  primary: '#FFFFFF',
  onPrimary: '#3B1FB0',
  record: '#FF4D6D',
  ring: { good: ['#5EF2B0', '#2DD4BF'], fair: ['#FFD36E', '#FF8A4C'], poor: ['#FF8FA3', '#FF4D6D'] },
  statusBar: 'light',
};

export const T = LIGHT;
