// Colours for the phone app, from the FairDrive brand (src/brand.ts): warm paper, white cards with a hairline
// border, FairDrive green. Flat: no shadows or background gradients.

import { C } from './brand';

export const T = {
  background: [C.paper, C.paper] as const,
  card: C.white,
  line: C.line,
  cardShadow: {},
  text: C.ink,
  muted: C.muted,
  faint: '#A39B8D',
  track: C.surface,
  primary: C.green,
  onPrimary: C.white,
  record: '#D92D20',
  tabBar: { backgroundColor: C.paper, borderTopColor: C.line, height: 84, paddingTop: 8 },
  // The first colour of each is dark enough to read as text on paper and white.
  ring: {
    good: ['#137A41', '#1F9D55'] as const,
    fair: ['#B45309', '#D97706'] as const,
    poor: ['#C81E1E', '#E11D48'] as const,
  },
};
