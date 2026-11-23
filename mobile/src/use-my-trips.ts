// The signed-in driver's trips, reloaded each time the screen using them comes into view.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { myTrips, TripRow } from './fairdrive';
import { useSession } from './session';

export function useMyTrips() {
  const { call } = useSession();
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setTrips(await call(myTrips));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call]);
  // Reload each time the tab opens, so a drive just sent shows up.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  return { trips, error, refreshing, refresh };
}
