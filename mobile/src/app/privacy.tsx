// What FairDrive records, what it keeps, who sees it, and how to delete it.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Page } from '../page';
import { T } from '../theme';
import { IconName, SecondaryButton, ui } from '../ui';

const SECTIONS: { icon: IconName; title: string; points: string[] }[] = [
  {
    icon: 'cellphone-sound',
    title: 'What your phone records',
    points: [
      'Only while a drive is running, from Start to Stop.',
      'Motion: how the car brakes, speeds up and turns, 50 times a second.',
      'Location: where the car is, once a second.',
      'Your phone model, so scores can be checked across phones.',
    ],
  },
  {
    icon: 'server-security',
    title: 'What the FairDrive server keeps',
    points: [
      'The first and last 500 m of every drive are cut off, so your home and workplace are not kept.',
      'The raw recording is never stored. Only the cleaned-up trip and its score are.',
      'Drives that fail a check, such as a GPS gap, keep no route at all.',
    ],
  },
  {
    icon: 'map-search-outline',
    title: 'Lookups about your route',
    points: [
      'To find road types and weather, the server sends the area of your trip to OpenStreetMap and Environment Canada.',
      'Your name and email are never sent.',
    ],
  },
  {
    icon: 'account-eye-outline',
    title: 'Who sees your trips',
    points: [
      'You, in this app.',
      'The admins of your FairDrive server (the research team), to check that scoring is fair.',
      'Nobody else. Your data is not sold or shared.',
    ],
  },
  {
    icon: 'delete-outline',
    title: 'Deleting your data',
    points: ['Profile → Delete account removes your account and every trip you uploaded, straight away.'],
  },
];

export default function Privacy() {
  return (
    <Page edges={['top', 'bottom']}>
      <Text style={ui.title}>Privacy</Text>
      <Text style={ui.lead}>FairDrive is a student research project. Here is exactly what it does with your data.</Text>
      {SECTIONS.map((section) => (
        <View key={section.title} style={[ui.card, s.section]}>
          <View style={s.head}>
            <MaterialCommunityIcons name={section.icon} size={22} color={T.ring.good[0]} />
            <Text style={ui.cardTitle}>{section.title}</Text>
          </View>
          {section.points.map((point) => (
            <View key={point} style={ui.tip}>
              <View style={ui.tipDot} />
              <Text style={ui.tipText}>{point}</Text>
            </View>
          ))}
        </View>
      ))}
      <View style={s.row}><SecondaryButton label="Done" onPress={() => router.back()} /></View>
    </Page>
  );
}

const s = StyleSheet.create({
  section: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row' },
});
