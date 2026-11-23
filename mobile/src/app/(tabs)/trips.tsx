// The Trips tab: every drive you've uploaded, newest first. Tap one to open it.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { TripRow } from '../../fairdrive';
import { DrivingRoad } from '../../motion';
import { Page } from '../../page';
import { T } from '../../theme';
import { day, NotScoredBadge, ScoreBadge, time } from '../../trip-parts';
import { PrimaryButton, ui } from '../../ui';
import { useMyTrips } from '../../use-my-trips';

export default function Trips() {
  const { trips, error, refreshing, refresh } = useMyTrips();
  const km = (trips ?? []).reduce((sum, t) => sum + t.distance_km, 0);

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Text style={ui.title}>Your trips</Text>
      {trips !== null && trips.length > 0 && <Text style={ui.lead}>{trips.length} {trips.length === 1 ? 'drive' : 'drives'} · {km.toFixed(0)} km</Text>}
      {error !== '' && <Text style={ui.error}>{error}</Text>}
      {trips === null && error === '' && <ActivityIndicator color={T.text} style={s.loading} />}
      {trips !== null && trips.length === 0 && (
        <View style={[ui.card, s.empty]}>
          <DrivingRoad kmh={20} />
          <Text style={ui.cardTitle}>No drives yet</Text>
          <Text style={[ui.muted, ui.centerText]}>Your drives show up here once you send one.</Text>
          <PrimaryButton label="Start a drive" onPress={() => router.navigate('/drive')} />
        </View>
      )}
      {trips?.map((trip) => <TripCard key={trip.trip_id} trip={trip} />)}
    </Page>
  );
}

function TripCard({ trip }: { trip: TripRow }) {
  return (
    <Pressable onPress={() => router.push(`/trip/${trip.trip_id}`)} style={({ pressed }) => [ui.card, s.card, pressed && ui.pressed]}>
      <View style={s.icon}><MaterialCommunityIcons name="car-side" size={22} color={T.text} /></View>
      <View style={s.flex}>
        <Text style={s.date}>{day(trip.start)}</Text>
        <Text style={ui.muted}>{time(trip.start)} · {trip.distance_km.toFixed(1)} km{trip.scored ? '' : ' · tap to see why'}</Text>
      </View>
      {trip.scored ? <ScoreBadge score={trip.driving_score} withWord={false} /> : <NotScoredBadge />}
      <MaterialCommunityIcons name="chevron-right" size={22} color={T.faint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: 40 },
  empty: { alignItems: 'center', gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.track, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  date: { color: T.text, fontSize: 16, fontWeight: '700' },
});
