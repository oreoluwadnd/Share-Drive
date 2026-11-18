// Building blocks shared by the driver app and the admin dashboard.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { T } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const PrimaryButton = ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) => (
  <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.primary, disabled && ui.disabled, pressed && ui.pressed]}>
    <Text style={ui.primaryText}>{label}</Text>
  </Pressable>
);

export function Field(p: {
  label: string; value: string; onChange: (t: string) => void; placeholder: string;
  keyboard?: 'url' | 'email-address'; secret?: boolean; onSubmit?: () => void;
}) {
  return (
    <View style={ui.field}>
      <Text style={ui.label}>{p.label}</Text>
      <TextInput
        style={ui.input} value={p.value} onChangeText={p.onChange} placeholder={p.placeholder} placeholderTextColor={T.faint}
        autoCapitalize="none" autoCorrect={false} keyboardType={p.keyboard ?? 'default'} secureTextEntry={p.secret}
        onSubmitEditing={p.onSubmit}
      />
    </View>
  );
}

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
  title: { color: T.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  lead: { color: T.muted, fontSize: 16, lineHeight: 23 },
  body: { color: T.text, fontSize: 16, lineHeight: 23 },
  muted: { color: T.muted, fontSize: 14, lineHeight: 20 },
  label: { color: T.muted, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: T.card, borderRadius: 28, padding: 20, gap: 8, ...T.cardShadow },
  cardDivider: { height: 1, backgroundColor: T.track, marginVertical: 8 },
  cardTitle: { color: T.text, fontSize: 18, fontWeight: '700' },
  section: { gap: 12 },
  sectionTitle: { color: T.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  field: { gap: 6 },
  input: { color: T.text, fontSize: 18, fontWeight: '600', paddingVertical: 4 },
  tips: { gap: 12 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.ring.good[0], marginTop: 8 },
  tipText: { color: T.text, fontSize: 15, lineHeight: 21, flex: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.track, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: T.text, fontSize: 13, fontWeight: '600' },
  primary: { backgroundColor: T.primary, borderRadius: 999, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  primaryText: { color: T.onPrimary, fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  error: { color: T.ring.poor[1], fontSize: 15, fontWeight: '600' },
});
