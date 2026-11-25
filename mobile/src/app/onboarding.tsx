// Three short slides, shown once before the first sign-in.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT } from '../brand';
import { Page } from '../page';
import { PHOTOS } from '../photos';
import { useSession } from '../session';
import { T } from '../theme';
import { IconName, PrimaryButton, ui } from '../ui';

const SLIDES = [
  {
    title: 'Scored on your driving. Not on your roads.',
    text: 'City streets need more braking than a highway. FairDrive compares you with what is normal for your roads, light and weather.',
  },
  {
    title: 'Mount your phone, tap Start, drive.',
    text: 'Your phone feels how the car brakes, speeds up and turns. No extra hardware.',
  },
  {
    title: 'Two permissions, used only while you drive.',
    text: 'FairDrive asks for these when you start your first drive.',
  },
];

export default function Onboarding() {
  const { finishOnboarding } = useSession();
  const [step, setStep] = useState(0);
  const last = step === SLIDES.length - 1;

  return (
    <Page>
      <View style={s.top}>
        <Text style={s.brand}>FairDrive</Text>
        {!last && <Pressable onPress={finishOnboarding} hitSlop={12}><Text style={s.skip}>Skip</Text></Pressable>}
      </View>

      <View style={s.visual}>
        {step === 0 && <Image source={PHOTOS.carSide} style={s.photo} resizeMode="cover" accessibilityLabel="A small white car driving along a tree-lined road" />}
        {step === 1 && <Image source={PHOTOS.mount} style={s.photo} resizeMode="cover" accessibilityLabel="A phone in a dashboard mount" />}
        {step === 2 && (
          <View style={[ui.card, s.permissions]}>
            <Permission icon="map-marker-radius" title="Location" text="To find your roads, speed limits, daylight and weather." />
            <View style={ui.cardDivider} />
            <Permission icon="axis-arrow" title="Motion" text="To feel braking, speeding up and turning." />
          </View>
        )}
      </View>

      <Text style={ui.title}>{SLIDES[step].title}</Text>
      <Text style={ui.lead}>{SLIDES[step].text}</Text>
      {last && <Link href="/privacy" style={ui.link}>How FairDrive uses your data</Link>}

      <View style={s.dots}>
        {SLIDES.map((_, i) => <View key={i} style={[s.dot, i === step && s.dotActive]} />)}
      </View>
      <PrimaryButton label={last ? 'Get started' : 'Next'} onPress={last ? finishOnboarding : () => setStep(step + 1)} />
    </Page>
  );
}

const Permission = ({ icon, title, text }: { icon: IconName; title: string; text: string }) => (
  <View style={s.permission}>
    <View style={s.permissionIcon}><MaterialCommunityIcons name={icon} size={22} color={T.ring.good[0]} /></View>
    <View style={s.flex}>
      <Text style={ui.cardTitle}>{title}</Text>
      <Text style={ui.muted}>{text}</Text>
    </View>
  </View>
);

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: T.text, fontSize: 17, fontFamily: FONT.head, letterSpacing: 0.3 },
  skip: { color: T.muted, fontSize: 16, fontFamily: FONT.bodyBold },
  visual: { minHeight: 240, justifyContent: 'center', marginVertical: 12 },
  photo: { width: '100%', height: 240, borderRadius: 28 },
  permissions: { gap: 4 },
  permission: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  permissionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${T.ring.good[0]}1F`, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.track },
  dotActive: { width: 24, backgroundColor: T.text },
});
