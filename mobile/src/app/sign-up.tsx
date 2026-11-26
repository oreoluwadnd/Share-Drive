import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthForm } from '../auth-form';
import { CompanyPicker } from '../company-picker';
import { InsuranceCompany } from '../fairdrive';
import { useSession } from '../session';
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
