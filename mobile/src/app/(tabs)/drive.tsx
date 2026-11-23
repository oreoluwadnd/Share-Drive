// The Drive tab: record a drive, send it as the signed-in driver, show the score.

import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useNavigation } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { sendTrip, TripResult } from '../../fairdrive';
import { DrivingRoad } from '../../motion';
import { Page } from '../../page';
import { Live, PermissionMissing, Recorder } from '../../recorder';
import { ScoredTrip } from '../../score';
import { useSession } from '../../session';
import { T } from '../../theme';
import { sentence } from '../../trip-parts';
import { PrimaryButton, SecondaryButton, Tip, ui } from '../../ui';

type Screen =
  | { name: 'ready' }
  | { name: 'recording'; live: Live }
  | { name: 'sending'; recording: File }
  | { name: 'results'; recording: File; trips: TripResult[] }
  | { name: 'problem'; message: string; recording?: File };

export default function Drive() {
  const { session, call } = useSession();
  const [screen, setScreen] = useState<Screen>({ name: 'ready' });
  const recorder = useRef<Recorder | null>(null);
  const navigation = useNavigation();

  // No switching tabs mid-drive: the tab bar hides while recording and sending.
  const busy = screen.name === 'recording' || screen.name === 'sending';
  useEffect(() => { navigation.setOptions({ tabBarStyle: busy ? { display: 'none' } : T.tabBar }); }, [busy, navigation]);

  async function start() {
    recorder.current = new Recorder();
    try {
      setScreen({ name: 'recording', live: { seconds: 0, km: 0, kmh: 0, gpsFixes: 0 } });
      await recorder.current.start((live) => setScreen({ name: 'recording', live }));
    } catch (error) {
      if (error instanceof PermissionMissing) {
        setScreen({ name: 'ready' });
        router.push({ pathname: '/permissions', params: { missing: error.which } });
      } else {
        setScreen({ name: 'problem', message: (error as Error).message });
      }
    }
  }

  async function stop() {
    try {
      send(await recorder.current!.stop());
    } catch (error) {
      setScreen({ name: 'problem', message: (error as Error).message });
    }
  }

  async function send(recording: File) {
    setScreen({ name: 'sending', recording });
    try {
      setScreen({ name: 'results', recording, trips: await call((s) => sendTrip(s, recording)) });
    } catch (error) {
      setScreen({ name: 'problem', recording, message: (error as Error).message });
    }
  }

  const save = (recording: File) => () => Sharing.shareAsync(recording.uri);
  const again = () => setScreen({ name: 'ready' });
  if (screen.name === 'recording') return <Page scroll={false}><Recording live={screen.live} onStop={stop} /></Page>;
  if (screen.name === 'sending') return <Page scroll={false}><Sending /></Page>;
  return (
    <Page>
      {screen.name === 'ready' && <Ready name={session!.driver.name} onStart={start} />}
      {screen.name === 'results' && <Results trips={screen.trips} onSave={save(screen.recording)} onNew={again} />}
      {screen.name === 'problem' && (
        <Problem
          message={screen.message}
          onRetry={screen.recording ? () => send(screen.recording!) : undefined}
          onSave={screen.recording ? save(screen.recording) : undefined}
          onNew={again}
        />
      )}
    </Page>
  );
}

function Ready({ name, onStart }: { name: string; onStart: () => void }) {
  return (
    <>
      <Text style={ui.muted}>Hi {name.split(' ')[0]}</Text>
      <Text style={ui.title}>Ready to drive</Text>
      <Text style={ui.lead}>Your score compares you with what's normal for your roads, light and weather.</Text>
      <DrivingRoad kmh={20} />
      <View style={[ui.card, ui.tips]}>
        <Tip text="Mount the phone firmly. Any angle works, but it mustn't move." />
        <Tip text="Keep this screen open. The phone stays awake while recording." />
        <Tip text="Drive at least 3 km so there's something to score." />
      </View>
      <PrimaryButton label="Start drive" onPress={onStart} />
    </>
  );
}

function Recording({ live, onStop }: { live: Live; onStop: () => void }) {
  useKeepAwake();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const minutes = Math.floor(live.seconds / 60);
  const seconds = Math.floor(live.seconds % 60).toString().padStart(2, '0');
  return (
    <View style={s.recordingPage}>
      <View style={s.timerPill}>
        <Animated.View style={[s.dot, { opacity: pulse }]} />
        <Text style={s.timerPillText}>{minutes}:{seconds}</Text>
      </View>
      <View style={ui.center}>
        <View style={s.roadWide}><DrivingRoad kmh={live.kmh} /></View>
        <Text style={s.bigNumber}>{live.km.toFixed(1)}</Text>
        <Text style={s.bigUnit}>km driven</Text>
        <View style={s.statRow}>
          <View style={[ui.card, s.stat]}>
            <Text style={s.statValue}>{live.kmh.toFixed(0)}</Text>
            <Text style={ui.muted}>km/h</Text>
          </View>
          <View style={[ui.card, s.stat]}>
            <Text style={s.statValue}>{live.gpsFixes > 0 ? 'Locked' : 'Searching'}</Text>
            <Text style={ui.muted}>GPS</Text>
          </View>
        </View>
      </View>
      <View style={s.stopArea}>
        <Pressable onPress={onStop} style={({ pressed }) => [s.stopButton, pressed && ui.pressed]}>
          <View style={s.stopSquare} />
        </Pressable>
        <Text style={ui.muted}>Finish and get your score</Text>
      </View>
    </View>
  );
}

function Sending() {
  return (
    <View style={[ui.page, ui.center]}>
      <View style={s.roadWide}><DrivingRoad kmh={60} /></View>
      <Text style={[ui.title, ui.centerText]}>Scoring your drive</Text>
      <Text style={[ui.lead, ui.centerText]}>Looking up the roads, daylight and weather on your route. This can take a minute.</Text>
    </View>
  );
}

function Results({ trips, onSave, onNew }: { trips: TripResult[]; onSave: () => void; onNew: () => void }) {
  return (
    <>
      <Text style={ui.title}>{trips.length === 1 ? 'Your drive' : `${trips.length} drives`}</Text>
      {trips.map((trip) => trip.kind === 'scored' ? <ScoredTrip key={trip.tripId} score={trip.score} reasons={trip.reasons} /> : (
        <View key={trip.tripId} style={ui.card}>
          <Text style={ui.cardTitle}>Not scored · {trip.distanceKm.toFixed(1)} km</Text>
          <Text style={ui.body}>{sentence(trip.why)}</Text>
        </View>
      ))}
      <PrimaryButton label="See all your trips" onPress={() => router.navigate('/trips')} />
      <Buttons onSave={onSave} onNew={onNew} />
    </>
  );
}

function Problem(p: { message: string; onRetry?: () => void; onSave?: () => void; onNew: () => void }) {
  return (
    <>
      <Text style={ui.title}>Something went wrong</Text>
      <View style={ui.card}>
        <Text style={ui.body}>{p.message}</Text>
      </View>
      {p.onRetry && <PrimaryButton label="Send again" onPress={p.onRetry} />}
      <Buttons onSave={p.onSave} onNew={p.onNew} />
    </>
  );
}

function Buttons({ onSave, onNew }: { onSave?: () => void; onNew: () => void }) {
  return (
    <View style={s.buttonRow}>
      {onSave && <SecondaryButton icon="content-save-outline" label="Save recording" onPress={onSave} />}
      <SecondaryButton icon="plus" label="New drive" onPress={onNew} />
    </View>
  );
}

const s = StyleSheet.create({
  recordingPage: { flex: 1, padding: 20, paddingBottom: 48 },
  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: T.record, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  timerPillText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  roadWide: { alignSelf: 'stretch', marginBottom: 24 },
  bigNumber: { color: T.text, fontSize: 120, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -6 },
  bigUnit: { color: T.muted, fontSize: 17, fontWeight: '600', marginTop: -10, marginBottom: 32 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { width: 140, alignItems: 'center', gap: 2 },
  statValue: { color: T.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stopArea: { alignItems: 'center', gap: 12 },
  stopButton: { width: 92, height: 92, borderRadius: 46, backgroundColor: T.record, alignItems: 'center', justifyContent: 'center', ...T.cardShadow },
  stopSquare: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFFFFF' },
  buttonRow: { flexDirection: 'row', gap: 12 },
});
