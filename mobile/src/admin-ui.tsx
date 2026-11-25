// Shared pieces of the web dashboard, in the FairDrive brand (src/brand.ts): warm paper, FairDrive green,
// flat colours, hairline borders.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { C, FONT, text as f } from './brand';

export const WIDE = 900;

export const Wordmark = ({ light }: { light?: boolean }) => (
  <View style={s.brandRow}>
    <View style={[s.mark, light && s.markLight]}>
      <MaterialCommunityIcons name="road-variant" size={16} color={light ? C.green : C.white} />
    </View>
    <Text style={[s.wordmark, light && s.onGreen]}>FairDrive</Text>
  </View>
);

/** kind sets the keyboard and what the browser offers to fill in. */
export function Input(p: {
  label: string; value: string; onChange: (t: string) => void; placeholder: string;
  kind: 'email' | 'password' | 'new-password' | 'name' | 'organization'; onSubmit: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const secret = p.kind === 'password' || p.kind === 'new-password';
  return (
    <View style={s.inputGroup}>
      <Text style={s.inputLabel}>{p.label}</Text>
      <TextInput
        style={[s.input, focused && s.inputFocused]} value={p.value} onChangeText={p.onChange} placeholder={p.placeholder} placeholderTextColor="#A39B8D"
        autoCapitalize={p.kind === 'name' || p.kind === 'organization' ? 'words' : 'none'} autoCorrect={false}
        keyboardType={p.kind === 'email' ? 'email-address' : 'default'} secureTextEntry={secret}
        autoComplete={p.kind === 'password' ? 'current-password' : p.kind} onSubmitEditing={p.onSubmit}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      />
    </View>
  );
}

export const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={s.stat}>
    <Text style={s.muted}>{label}</Text>
    <Text style={s.statValue}>{value}</Text>
  </View>
);

export const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.filter, hovered && s.filterHover, active && s.filterActive]}>
    <Text style={[s.filterText, active && s.filterTextActive]}>{label}</Text>
  </Pressable>
);

export function Button({ label, outline, danger, small, disabled, onPress }: {
  label: string; outline?: boolean; danger?: boolean; small?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
      s.button, danger && s.buttonDanger, outline && s.buttonOutline, small && s.buttonSmall,
      hovered && (outline ? s.buttonOutlineHover : danger ? s.buttonDangerHover : s.buttonHover),
      pressed && s.buttonPressed, disabled && s.buttonDisabled,
    ]}>
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <Text style={[s.buttonText, outline && !hovered && s.buttonTextOutline, small && s.buttonTextSmall]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** A quiet button that asks once more before doing something hard to undo. */
export function ConfirmButton({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button label={label} outline small onPress={() => setAsking(true)} />;
  return (
    <View style={s.actions}>
      <Button label={confirm} danger small onPress={() => { setAsking(false); onConfirm(); }} />
      <Button label="Cancel" outline small onPress={() => setAsking(false)} />
    </View>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => <Text style={[s.link, hovered && s.linkHover]}>{label}</Text>}
    </Pressable>
  );
}

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 1160, alignSelf: 'center', paddingHorizontal: 24 },
  page: { paddingTop: 40, paddingBottom: 80 },
  stack: { gap: 24 },
  onGreen: { color: C.white },
  onGreenMuted: { color: C.onGreenMuted },

  loginPage: { flexGrow: 1, minHeight: '100%' } as object,
  loginPanel: { backgroundColor: C.green, padding: 32, gap: 48 },
  loginPanelWide: { flex: 1, padding: 56, justifyContent: 'space-between' },
  loginPanelText: { gap: 16, maxWidth: 520 },
  loginForm: { padding: 32, justifyContent: 'center' },
  loginFormWide: { flex: 1, padding: 56 },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 18 },

  topBar: { paddingTop: 14, backgroundColor: C.paper, borderBottomWidth: 1, borderBottomColor: C.line },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabRow: { flexDirection: 'row', gap: 24, marginTop: 10 },
  tab: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: C.green },
  tabText: f(FONT.bodyMedium, { fontSize: 15, color: C.muted }),
  tabTextActive: { color: C.ink },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  markLight: { backgroundColor: C.white },
  wordmark: f(FONT.head, { fontSize: 22, letterSpacing: -0.4 }),
  section: f(FONT.bodyMedium, { fontSize: 15, color: C.muted, paddingLeft: 12, marginLeft: 2, borderLeftWidth: 1, borderLeftColor: C.line }),

  h1: f(FONT.head, { fontSize: 56, lineHeight: 60, letterSpacing: -1.6 }),
  h1Narrow: { fontSize: 38, lineHeight: 42, letterSpacing: -1 },
  h2: f(FONT.head, { fontSize: 36, lineHeight: 42, letterSpacing: -0.8 }),
  lead: f(FONT.body, { fontSize: 19, lineHeight: 28 }),
  body: f(FONT.body, { fontSize: 16, lineHeight: 24 }),
  muted: f(FONT.body, { fontSize: 15, lineHeight: 22, color: C.muted }),
  error: f(FONT.bodyMedium, { fontSize: 15, color: C.red }),

  inputGroup: { gap: 6 },
  inputLabel: f(FONT.bodyMedium, { fontSize: 14 }),
  input: { fontFamily: FONT.body, fontSize: 16, color: C.ink, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  inputFocused: { borderColor: C.green },

  headRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 },
  loading: { marginTop: 40 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 160, gap: 4, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 20 },
  statValue: f(FONT.head, { fontSize: 40, lineHeight: 46, letterSpacing: -1 }),

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  filterHover: { borderColor: C.ink },
  filterActive: { backgroundColor: C.ink, borderColor: C.ink },
  filterText: f(FONT.bodyMedium, { fontSize: 14 }),
  filterTextActive: { color: C.white },

  table: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  trDivider: { borderTopWidth: 1, borderTopColor: C.line },
  trHover: { backgroundColor: C.paper },
  thRow: { backgroundColor: C.paper, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  th: f(FONT.bodyMedium, { fontSize: 13, color: C.muted }),
  td: f(FONT.bodyMedium, { fontSize: 15, fontVariant: ['tabular-nums'] }),
  colTrip: { flex: 1 },
  colNum: { width: 100, textAlign: 'right' },
  colWide: { width: 200 },
  colAction: { width: 320, alignItems: 'flex-end' },
  wrap: { flexWrap: 'wrap' },
  minWide: { minWidth: 220 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  inviteRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  linkBox: { gap: 8, marginTop: 8, padding: 16, borderRadius: 12, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  linkText: f(FONT.bodyMedium, { fontSize: 14 }),
  colScore: { width: 150, alignItems: 'flex-end', textAlign: 'right' } as object,
  tripCell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driver: f(FONT.bodyBold, { fontSize: 16 }),
  empty: { padding: 20 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  twoColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  mainColumn: { flex: 3 },
  sideColumn: { flex: 2 },
  panel: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 24, gap: 8 },
  panelTitle: f(FONT.headSemi, { fontSize: 22 }),

  button: { backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 15, alignItems: 'center' },
  buttonDanger: { backgroundColor: C.red },
  buttonDangerHover: { opacity: 0.9 },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.ink },
  buttonSmall: { paddingHorizontal: 18, paddingVertical: 9 },
  buttonHover: { backgroundColor: C.greenHover, transform: [{ translateY: -1 }] },
  buttonOutlineHover: { backgroundColor: C.ink },
  buttonPressed: { transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.4 },
  buttonText: f(FONT.bodyBold, { color: C.white, fontSize: 17 }),
  buttonTextOutline: { color: C.ink },
  buttonTextSmall: { fontSize: 14 },
  link: f(FONT.bodyBold, { fontSize: 15, color: C.green }),
  linkHover: { textDecorationLine: 'underline' },
});
