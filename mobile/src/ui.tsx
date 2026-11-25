// Building blocks shared by the driver app and the admin dashboard.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ComponentProps } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FONT } from './brand';
import { T } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const PrimaryButton = ({ label, disabled, danger, onPress }: { label: string; disabled?: boolean; danger?: boolean; onPress: () => void }) => (
  <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.primary, danger && ui.danger, disabled && ui.disabled, pressed && ui.pressed]}>
    <Text style={ui.primaryText}>{label}</Text>
  </Pressable>
);

export const SecondaryButton = ({ label, icon, onPress }: { label: string; icon?: IconName; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [ui.card, ui.secondary, pressed && ui.pressed]}>
    {icon && <MaterialCommunityIcons name={icon} size={18} color={T.text} />}
    <Text style={ui.secondaryText}>{label}</Text>
  </Pressable>
);

export function Field(p: {
  label: string; value: string; onChange: (t: string) => void; placeholder: string;
  keyboard?: 'url' | 'email-address'; secret?: boolean; onSubmit?: () => void;
  autoComplete?: 'name' | 'email' | 'current-password' | 'new-password';
}) {
  return (
    <View style={ui.field}>
      <Text style={ui.label}>{p.label}</Text>
      <TextInput
        style={ui.input} value={p.value} onChangeText={p.onChange} placeholder={p.placeholder} placeholderTextColor={T.faint}
        autoCapitalize={p.autoComplete === 'name' ? 'words' : 'none'} autoCorrect={false} keyboardType={p.keyboard ?? 'default'}
        secureTextEntry={p.secret} autoComplete={p.autoComplete}
        onSubmitEditing={p.onSubmit}
      />
    </View>
  );
}

/** A rounded photo across the screen, for the top of a page. */
export const Banner = ({ source, label, height = 190 }: { source: ImageSourcePropType; label: string; height?: number }) => (
  <Image source={source} style={[ui.banner, { height }]} resizeMode="cover" accessibilityLabel={label} />
);

/** A large icon in a soft circle, for empty screens. */
export const EmptyIcon = ({ icon }: { icon: IconName }) => (
  <View style={ui.emptyIcon}><MaterialCommunityIcons name={icon} size={36} color={T.muted} /></View>
);

export const Tip = ({ text }: { text: string }) => (
  <View style={ui.tip}>
    <View style={ui.tipDot} />
    <Text style={ui.tipText}>{text}</Text>
  </View>
);

export const Chip = ({ icon, text }: { icon: IconName; text: string }) => (
  <View style={ui.chip}>
    <MaterialCommunityIcons name={icon} size={16} color={T.muted} />
    <Text style={ui.chipText}>{text}</Text>
  </View>
);

// Same cut-offs as FairDrive's dashboard (src/fairdrive/scoring.py).
export function drivingTier(score: number): { word: string; level: 'good' | 'fair' | 'poor' } {
  if (score >= 80) return { word: 'Excellent', level: 'good' };
  if (score >= 60) return { word: 'Good', level: 'good' };
  if (score >= 40) return { word: 'Fair', level: 'fair' };
  return { word: 'Needs attention', level: 'poor' };
}

export function conditionsWord(score: number): string {
  if (score >= 80) return 'Easy';
  if (score >= 60) return 'Fairly easy';
  if (score >= 40) return 'Average';
  return 'Demanding';
}

export const ui = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  title: { color: T.text, fontSize: 34, fontFamily: FONT.head, letterSpacing: -0.8 },
  lead: { fontFamily: FONT.body, color: T.muted, fontSize: 16, lineHeight: 23 },
  body: { fontFamily: FONT.body, color: T.text, fontSize: 16, lineHeight: 23 },
  muted: { fontFamily: FONT.body, color: T.muted, fontSize: 14, lineHeight: 20 },
  label: { color: T.muted, fontSize: 13, fontFamily: FONT.bodyMedium },
  card: { backgroundColor: T.card, borderRadius: 24, padding: 20, gap: 8, borderWidth: 1, borderColor: T.line },
  cardDivider: { height: 1, backgroundColor: T.track, marginVertical: 8 },
  cardTitle: { color: T.text, fontSize: 19, fontFamily: FONT.headSemi },
  section: { gap: 12 },
  sectionTitle: { color: T.text, fontSize: 21, fontFamily: FONT.head, letterSpacing: -0.3, marginTop: 8 },
  field: { gap: 6 },
  input: { color: T.text, fontSize: 18, fontFamily: FONT.bodyMedium, paddingVertical: 4 },
  tips: { gap: 12 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.ring.good[0], marginTop: 8 },
  tipText: { fontFamily: FONT.body, color: T.text, fontSize: 15, lineHeight: 21, flex: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.track, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: T.text, fontSize: 13, fontFamily: FONT.bodyMedium },
  primary: { backgroundColor: T.primary, borderRadius: 999, paddingVertical: 18, paddingHorizontal: 28, alignItems: 'center', marginTop: 4 },
  primaryText: { color: T.onPrimary, fontSize: 17, fontFamily: FONT.bodyBold },
  danger: { backgroundColor: T.record },
  secondary: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 16 },
  secondaryText: { color: T.text, fontSize: 16, fontFamily: FONT.bodyBold },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  error: { color: T.ring.poor[1], fontSize: 15, fontFamily: FONT.bodyMedium },
  link: { color: T.text, fontSize: 15, fontFamily: FONT.bodyBold, textDecorationLine: 'underline' },
  row: { flexDirection: 'row' },
  banner: { width: '100%', borderRadius: 28 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: T.track, alignItems: 'center', justifyContent: 'center' },
});
