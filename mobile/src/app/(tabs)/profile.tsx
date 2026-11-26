// The Profile tab: who you are, privacy, permission help, sign out and delete account.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT } from '../../brand';
import { CompanyPicker } from '../../company-picker';
import { chooseCompany, Driver, me } from '../../fairdrive';
import { Page } from '../../page';
import { useSession, useSignedIn } from '../../session';
import { T } from '../../theme';
import { Avatar } from '../../trip-parts';
import { IconName, ui } from '../../ui';

export default function Profile() {
  const session = useSignedIn();
  const { signOut, call } = useSession();
  const [error, setError] = useState('');
  // Fresh from the server: the insurer can change after sign-in (a company removed the driver, or stopped using FairDrive).
  const [driver, setDriver] = useState<Driver | null>(null);

  useEffect(() => { call(me).then(setDriver).catch((e) => setError((e as Error).message)); }, [call]);

  function choose(companyId: string) {
    setError('');
    call((session) => chooseCompany(session, companyId)).then(setDriver).catch((e) => setError((e as Error).message));
  }

  return (
    <Page>
      <Text style={ui.title}>Profile</Text>
      <View style={[ui.card, s.who]}>
        <Avatar name={session.driver.name} big />
        <View style={s.flex}>
          <Text style={s.name}>{session.driver.name}</Text>
          <Text style={ui.muted}>{session.driver.email}</Text>
        </View>
      </View>

      {driver?.company && (
        <View style={[ui.card, s.list]}>
          <Row icon="shield-car" label="Insurance company" detail={driver.company.name} />
        </View>
      )}
      {driver && !driver.company && (
        <View style={ui.card}>
          <Text style={ui.cardTitle}>Choose your insurance company</Text>
          <Text style={ui.muted}>Your insurer sees your trips and scores. You can choose once.</Text>
          <View style={ui.cardDivider} />
          <CompanyPicker value={null} onChange={(c) => choose(c.company_id)} />
        </View>
      )}

      <View style={[ui.card, s.list]}>
        <Row icon="shield-lock-outline" label="Privacy" href="/privacy" />
        <Row icon="map-marker-radius" label="Location and motion help" href="/permissions" />
      </View>

      <View style={[ui.card, s.list]}>
        <Row icon="logout" label="Sign out" onPress={() => signOut().catch((e) => setError((e as Error).message))} />
        <Row icon="delete-outline" label="Delete account" href="/delete-account" danger />
      </View>
      {error !== '' && <Text style={ui.error}>{error}</Text>}

      <Text style={[ui.muted, ui.centerText]}>FairDrive {Constants.expoConfig?.version}</Text>
    </Page>
  );
}

function Row(p: { icon: IconName; label: string; detail?: string; href?: Href; onPress?: () => void; danger?: boolean }) {
  const color = p.danger ? T.record : T.text;
  const press = p.onPress ?? (p.href ? () => router.push(p.href!) : undefined);
  return (
    <Pressable disabled={!press} onPress={press} style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
      <MaterialCommunityIcons name={p.icon} size={22} color={color} />
      <Text style={[s.rowLabel, { color }]}>{p.label}</Text>
      {p.detail && <Text style={ui.muted} numberOfLines={1}>{p.detail}</Text>}
      {press && p.href && <MaterialCommunityIcons name="chevron-right" size={22} color={T.faint} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1 },
  name: { color: T.text, fontSize: 22, fontFamily: FONT.head },
  list: { paddingVertical: 6, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  rowPressed: { opacity: 0.6 },
  rowLabel: { flex: 1, fontSize: 16, fontFamily: FONT.bodyMedium },
});
