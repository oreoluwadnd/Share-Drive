// Deletes the account and every trip it uploaded. Two taps, so it can't happen by accident.

import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Page } from '../page';
import { useSession, useSignedIn } from '../session';
import { PrimaryButton, SecondaryButton, Tip, ui } from '../ui';

export default function DeleteAccount() {
  const session = useSignedIn();
  const { deleteAccount } = useSession();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await deleteAccount();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Page edges={['top', 'bottom']}>
      <Text style={ui.title}>Delete your account</Text>
      <Text style={ui.lead}>This deletes the account {session.driver.email}, along with:</Text>
      <View style={[ui.card, ui.tips]}>
        <Tip text="Every trip you uploaded, with its scores and route." />
        <Tip text="Your name, email and password." />
        <Tip text="Your sign-in on every phone." />
      </View>
      <Text style={ui.body}>This can't be undone. Recordings you saved to your phone stay on your phone.</Text>
      {error !== '' && <Text style={ui.error}>{error}</Text>}
      <PrimaryButton
        danger disabled={busy}
        label={busy ? 'Deleting…' : sure ? 'Tap again to delete everything' : 'Delete my account and trips'}
        onPress={sure ? remove : () => setSure(true)}
      />
      <View style={ui.row}>
        <SecondaryButton label="Keep my account" onPress={() => router.back()} />
      </View>
    </Page>
  );
}
