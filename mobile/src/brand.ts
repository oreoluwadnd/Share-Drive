// The FairDrive website brand, shared by the landing page and the admin dashboard: warm paper,
// FairDrive green, ink type, Bricolage Grotesque headings and DM Sans text. Flat colours only.

import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { TextStyle } from 'react-native';

export const C = {
  paper: '#F6F2EA', surface: '#EDE6D9', white: '#FFFFFF', ink: '#17140F', muted: '#665F53', line: '#DDD5C6',
  green: '#137A41', greenHover: '#0F6A38', greenSoft: '#DDEEDD', amber: '#B45309', red: '#C2410C',
  onInk: '#F6F2EA', onInkMuted: '#A9A193', onGreenMuted: '#D7EBDD',
};

export const FONT = {
  head: 'BricolageGrotesque_700Bold',
  headSemi: 'BricolageGrotesque_600SemiBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
};

/** True once the brand fonts are ready to draw. */
export function useBrandFonts(): boolean {
  const [ready] = useFonts({ BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  return ready;
}

/** A text style in a brand font, ink by default. */
export const text = (family: string, style: TextStyle): TextStyle => ({ fontFamily: family, color: C.ink, ...style });
