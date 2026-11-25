import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthForm } from '../auth-form';
import { FONT } from '../brand';
import { insuranceCompanies, InsuranceCompany } from '../fairdrive';
import { useSession } from '../session';
import { T } from '../theme';
import { Field, ui } from '../ui';

export default function SignUp() {
  const { signUp } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState<InsuranceCompany | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = name.trim() !== '' && email.trim() !== '' && password !== '' && company !== null;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await signUp(name, email, password, company.company_id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthForm
      title="Create your account" lead="Your trips and scores are kept under this account. Only you and your insurance company can see them."
      error={error} busy={busy} ready={ready} button="Create account" onSubmit={submit}
      switchText="Already have an account?" switchLink="Sign in" switchHref="/sign-in"
      footer={<Text style={[ui.muted, ui.centerText]}>Read <Link href="/privacy" style={ui.link}>how FairDrive uses your data</Link>.</Text>}
      fields={<>
        <CompanyPicker value={company} onChange={setCompany} />
        <View style={ui.cardDivider} />
        <Field label="Your name" value={name} onChange={setName} placeholder="Ana Silva" autoComplete="name" />
        <View style={ui.cardDivider} />
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" autoComplete="email" />
        <View style={ui.cardDivider} />
        <Field label="Password" value={password} onChange={setPassword} placeholder="At least 8 characters" secret autoComplete="new-password" onSubmit={submit} />
      </>}
    />
  );
}

/** A dropdown of the insurance companies that use FairDrive. It opens in place, under the row. */
function CompanyPicker({ value, onChange }: { value: InsuranceCompany | null; onChange: (company: InsuranceCompany) => void }) {
  const [companies, setCompanies] = useState<InsuranceCompany[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { insuranceCompanies().then(setCompanies).catch((e) => setError((e as Error).message)); }, []);

  return (
    <View style={ui.field}>
      <Text style={ui.label}>Insurance company</Text>
      <Pressable onPress={() => setOpen(!open)} disabled={!companies?.length} style={s.row} accessibilityRole="button">
        <Text style={[ui.input, s.flex, !value && s.placeholder]}>
          {value?.name ?? (companies === null ? 'Loading…' : companies.length ? 'Choose your insurer' : 'No insurers use FairDrive yet')}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={T.muted} />
      </Pressable>
      {error !== '' && <Text style={ui.error}>{error}</Text>}
      {open && companies?.map((c) => (
        <Pressable key={c.company_id} onPress={() => { onChange(c); setOpen(false); }} style={({ pressed }) => [s.option, pressed && s.optionPressed]}>
          <Text style={[s.optionText, c.company_id === value?.company_id && s.optionChosen]}>{c.name}</Text>
          {c.company_id === value?.company_id && <MaterialCommunityIcons name="check" size={18} color={T.primary} />}
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  placeholder: { color: T.faint },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.track },
  optionPressed: { opacity: 0.6 },
  optionText: { color: T.text, fontSize: 16, fontFamily: FONT.body },
  optionChosen: { fontFamily: FONT.bodyBold },
});
