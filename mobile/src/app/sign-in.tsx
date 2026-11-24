import { useState } from 'react';
import { View } from 'react-native';

import { AuthForm } from '../auth-form';
import { useSession } from '../session';
import { Field, ui } from '../ui';

export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = email.trim() !== '' && password !== '';

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthForm
      title="Welcome back" lead="Sign in to record drives and see your scores."
      error={error} busy={busy} ready={ready} button="Sign in" onSubmit={submit}
      switchText="New to FairDrive?" switchLink="Create an account" switchHref="/sign-up"
      fields={<>
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" autoComplete="email" />
        <View style={ui.cardDivider} />
        <Field label="Password" value={password} onChange={setPassword} placeholder="Your password" secret autoComplete="current-password" onSubmit={submit} />
      </>}
    />
  );
}
