// How to turn on location and motion. Opened when a drive can't start, and from Profile.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Page } from '../page';
import { T } from '../theme';
import { IconName, PrimaryButton, SecondaryButton, ui } from '../ui';

const APP = 'FairDrive';
const STEPS = Platform.OS === 'ios'
  ? {
      location: [`Open Settings → ${APP} → Location.`, 'Choose "While Using the App" and turn on Precise Location.'],
      motion: [`Open Settings → ${APP}.`, 'Turn on Motion & Fitness.'],
    }
  : {
      location: [`Open Settings → Apps → ${APP} → Permissions → Location.`, 'Choose "Allow only while using the app" and turn on "Use precise location".'],
      motion: [`Open Settings → Apps → ${APP} → Permissions.`, 'Allow "Physical activity" if it is listed.'],
    };

export default function Permissions() {
  const { missing } = useLocalSearchParams<{ missing?: 'location' | 'motion' }>();
  return (
    <Page edges={['top', 'bottom']}>
      <Text style={ui.title}>{missing ? `Turn on ${missing}` : 'Location and motion'}</Text>
      <Text style={ui.lead}>
        {missing ? "FairDrive can't record a drive without it. " : ''}Both are used only while a drive is running.
      </Text>
      {(!missing || missing === 'location') && (
        <Card icon="map-marker-radius" title="Location" why="Finds your roads, speed limits, daylight and weather." steps={STEPS.location} />
      )}
      {(!missing || missing === 'motion') && (
        <Card icon="axis-arrow" title="Motion" why="Feels braking, speeding up and turning." steps={STEPS.motion} />
      )}
      <PrimaryButton label="Open Settings" onPress={() => Linking.openSettings()} />
      <View style={s.row}><SecondaryButton label={missing ? "I've turned it on" : 'Done'} onPress={() => router.back()} /></View>
    </Page>
  );
}

const Card = ({ icon, title, why, steps }: { icon: IconName; title: string; why: string; steps: string[] }) => (
  <View style={[ui.card, s.card]}>
    <View style={s.head}>
      <MaterialCommunityIcons name={icon} size={22} color={T.ring.good[0]} />
      <Text style={ui.cardTitle}>{title}</Text>
    </View>
    <Text style={ui.muted}>{why}</Text>
    {steps.map((step, i) => (
      <View key={step} style={s.step}>
        <Text style={s.stepNumber}>{i + 1}</Text>
        <Text style={ui.tipText}>{step}</Text>
      </View>
    ))}
  </View>
);

const s = StyleSheet.create({
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNumber: { color: T.text, fontSize: 14, fontWeight: '800', width: 22, height: 22, borderRadius: 11, backgroundColor: T.track, textAlign: 'center', lineHeight: 22, overflow: 'hidden' },
  row: { flexDirection: 'row' },
});
