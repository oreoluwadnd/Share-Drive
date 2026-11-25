// The sign-in and sign-up screens share this frame: brand, title, fields, error and button.

import { Link } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PHOTOS } from './photos';
import { Page } from './page';
import { T } from './theme';
import { Banner, PrimaryButton, ui } from './ui';

export function AuthForm(p: {
  title: string; lead: string; fields: ReactNode; error: string; busy: boolean; ready: boolean;
  button: string; onSubmit: () => void; switchText: string; switchLink: string; switchHref: '/sign-in' | '/sign-up'; footer?: ReactNode;
}) {
  return (
    <Page>
      <Text style={s.brand}>FairDrive</Text>
      <Text style={ui.title}>{p.title}</Text>
      <Text style={ui.lead}>{p.lead}</Text>
      <Banner source={PHOTOS.road} label="A small car driving down a country road" height={170} />
      <View style={ui.card}>{p.fields}</View>
      {p.error !== '' && <Text style={ui.error}>{p.error}</Text>}
      <PrimaryButton label={p.busy ? 'One moment…' : p.button} disabled={!p.ready || p.busy} onPress={p.onSubmit} />
      {p.footer}
      <Text style={[ui.muted, ui.centerText]}>
        {p.switchText} <Link href={p.switchHref} replace style={ui.link}>{p.switchLink}</Link>
      </Text>
    </Page>
  );
}

const s = StyleSheet.create({
  brand: { color: T.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
});
