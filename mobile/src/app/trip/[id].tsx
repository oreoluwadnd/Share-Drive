// One of your trips: the score, the reasons and the route.

import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { myTrip, TripDetail } from '../../fairdrive';
import { Page } from '../../page';
import { ScoredTrip } from '../../score';
import { useSession } from '../../session';
import { T } from '../../theme';
import { RouteCard, sentence, when } from '../../trip-parts';
import { ui } from '../../ui';

export default function Trip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { call } = useSession();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    call((s) => myTrip(s, id)).then(setTrip).catch((e) => setError((e as Error).message));
  }, [id, call]);

  return (
    <Page edges={[]}>
      <Stack.Screen options={{ title: trip ? when(trip.start) : 'Trip' }} />
      {error !== '' && <Text style={ui.error}>{error}</Text>}
      {trip === null && error === '' && <ActivityIndicator color={T.text} style={s.loading} />}
      {trip !== null && (
        <>
          {trip.scored ? <ScoredTrip score={trip.score} reasons={trip.reasons} /> : (
            <View style={ui.card}>
              <Text style={ui.cardTitle}>Not scored</Text>
              <Text style={ui.body}>{sentence(trip.why)}</Text>
            </View>
          )}
          <RouteCard route={trip.route} />
        </>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: 40 },
});
