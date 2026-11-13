import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { sendTrip, serverUrl, TripResult } from './src/fairdrive';
import { Live, Recorder } from './src/recorder';

const C = {
  bg: '#0B0E0D', card: '#151A18', line: '#242B28', text: '#F1F4F2', muted: '#8C9691',
  green: '#3DD68C', amber: '#F5B544', red: '#F0524D', onGreen: '#062114',
};

type Screen =
  | { name: 'ready' }
  | { name: 'recording'; live: Live }
  | { name: 'sending'; recording: File }
  | { name: 'results'; recording: File; trips: TripResult[] }
  | { name: 'problem'; message: string; recording?: File };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'ready' });
  const [driver, setDriver] = useState('');
  const [server, setServer] = useState('');
  const recorder = useRef<Recorder | null>(null);

  async function start() {
    recorder.current = new Recorder();
    try {
      setScreen({ name: 'recording', live: { seconds: 0, km: 0, kmh: 0, gpsFixes: 0 } });
      await recorder.current.start((live) => setScreen({ name: 'recording', live }));
    } catch (error) {
      setScreen({ name: 'problem', message: (error as Error).message });
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
      setScreen({ name: 'results', recording, trips: await sendTrip(serverUrl(server), driver.trim(), recording) });
    } catch (error) {
      setScreen({ name: 'problem', recording, message: `${(error as Error).message}\n\nCheck the server address and that your phone is on the same Wi-Fi as the laptop.` });
    }
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <Text style={s.brand}>FairDrive</Text>
      {screen.name === 'ready' && (
        <Ready driver={driver} server={server} onDriver={setDriver} onServer={setServer} onStart={start} />
      )}
      {screen.name === 'recording' && <Recording live={screen.live} onStop={stop} />}
      {screen.name === 'sending' && <Sending />}
      {screen.name === 'results' && (
        <Results trips={screen.trips} onSave={() => Sharing.shareAsync(screen.recording.uri)} onNew={() => setScreen({ name: 'ready' })} />
      )}
      {screen.name === 'problem' && (
        <Problem
          message={screen.message}
          onRetry={screen.recording ? () => send(screen.recording!) : undefined}
          onSave={screen.recording ? () => Sharing.shareAsync(screen.recording!.uri) : undefined}
          onNew={() => setScreen({ name: 'ready' })}
        />
      )}
    </View>
  );
}

function Ready(p: { driver: string; server: string; onDriver: (t: string) => void; onServer: (t: string) => void; onStart: () => void }) {
  const canStart = p.driver.trim() !== '' && p.server.trim() !== '';
  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Ready to drive</Text>
      <Text style={s.lead}>Your score compares you with what's normal for your roads, light and weather.</Text>

      <Field label="Driver name" value={p.driver} onChange={p.onDriver} placeholder="e.g. Ana" />
      <Field label="FairDrive server" value={p.server} onChange={p.onServer} placeholder="192.168.1.20:8000" keyboard="url" />

      <View style={s.tips}>
        <Tip text="Mount the phone firmly. Any angle works, but it mustn't move." />
        <Tip text="Keep this screen open. The phone stays awake while recording." />
        <Tip text="Drive at least 3 km so there's something to score." />
      </View>

      <Pressable disabled={!canStart} onPress={p.onStart} style={({ pressed }) => [s.startButton, !canStart && s.disabled, pressed && s.pressed]}>
        <Text style={s.startText}>Start drive</Text>
      </Pressable>
    </ScrollView>
  );
}

function Recording({ live, onStop }: { live: Live; onStop: () => void }) {
  useKeepAwake();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const minutes = Math.floor(live.seconds / 60);
  const seconds = Math.floor(live.seconds % 60).toString().padStart(2, '0');
  return (
    <View style={[s.page, s.center]}>
      <View style={s.recordingBadge}>
        <Animated.View style={[s.dot, { opacity: pulse }]} />
        <Text style={s.recordingText}>Recording</Text>
      </View>
      <Text style={s.timer}>{minutes}:{seconds}</Text>
      <View style={s.stats}>
        <Stat value={live.km.toFixed(1)} unit="km" />
        <Stat value={live.kmh.toFixed(0)} unit="km/h" />
        <Stat value={live.gpsFixes > 0 ? 'On' : 'Waiting'} unit="GPS" />
      </View>
      <Pressable onPress={onStop} style={({ pressed }) => [s.stopButton, pressed && s.pressed]}>
        <View style={s.stopSquare} />
      </Pressable>
      <Text style={s.muted}>Tap to finish and get your score</Text>
    </View>
  );
}

function Sending() {
  return (
    <View style={[s.page, s.center]}>
      <ActivityIndicator size="large" color={C.green} />
      <Text style={[s.title, s.centerText]}>Scoring your drive</Text>
      <Text style={[s.lead, s.centerText]}>Looking up the roads, daylight and weather on your route. This can take a minute.</Text>
    </View>
  );
}

function Results({ trips, onSave, onNew }: { trips: TripResult[]; onSave: () => void; onNew: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.title}>{trips.length === 1 ? 'Your drive' : `${trips.length} drives`}</Text>
      {trips.map((trip) => (
        <View key={trip.tripId} style={s.card}>
          {trip.kind === 'scored' ? (
            <>
              <View style={s.scoreRow}>
                <ScoreBlock label="Driving" value={trip.score.driving_score} tier={drivingTier(trip.score.driving_score)} hint="Yours to control" />
                <View style={s.divider} />
                <ScoreBlock label="Conditions" value={trip.score.conditions_score} tier={conditionsTier(trip.score.conditions_score)} hint="100 = easiest" />
              </View>
              <Text style={s.meta}>{trip.score.km} km scored · old score {trip.score.old_score.toFixed(0)}</Text>
              <Reasons title="Your driving" items={trip.reasons.driving_reasons} />
              <Reasons title="The conditions" items={trip.reasons.conditions_reasons} />
            </>
          ) : (
            <>
              <Text style={s.cardTitle}>Not scored · {trip.distanceKm.toFixed(1)} km</Text>
              <Text style={s.body}>{trip.why}</Text>
            </>
          )}
        </View>
      ))}
      <Buttons onSave={onSave} onNew={onNew} />
    </ScrollView>
  );
}

function Problem(p: { message: string; onRetry?: () => void; onSave?: () => void; onNew: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.title}>Something went wrong</Text>
      <View style={[s.card, s.problemCard]}>
        <Text style={s.body}>{p.message}</Text>
      </View>
      {p.onRetry && (
        <Pressable onPress={p.onRetry} style={({ pressed }) => [s.startButton, pressed && s.pressed]}>
          <Text style={s.startText}>Send again</Text>
        </Pressable>
      )}
      <Buttons onSave={p.onSave} onNew={p.onNew} />
    </ScrollView>
  );
}

function Buttons({ onSave, onNew }: { onSave?: () => void; onNew: () => void }) {
  return (
    <View style={s.buttonRow}>
      {onSave && (
        <Pressable onPress={onSave} style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
          <Text style={s.secondaryText}>Save recording</Text>
        </Pressable>
      )}
      <Pressable onPress={onNew} style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
        <Text style={s.secondaryText}>New drive</Text>
      </Pressable>
    </View>
  );
}

function Field(p: { label: string; value: string; onChange: (t: string) => void; placeholder: string; keyboard?: 'url' }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{p.label}</Text>
      <TextInput
        style={s.input} value={p.value} onChangeText={p.onChange} placeholder={p.placeholder}
        placeholderTextColor="#55605B" autoCapitalize="none" autoCorrect={false} keyboardType={p.keyboard ?? 'default'}
      />
    </View>
  );
}

const Tip = ({ text }: { text: string }) => (
  <View style={s.tip}>
    <View style={s.tipDot} />
    <Text style={s.tipText}>{text}</Text>
  </View>
);

const Stat = ({ value, unit }: { value: string; unit: string }) => (
  <View style={s.stat}>
    <Text style={s.statValue}>{value}</Text>
    <Text style={s.statUnit}>{unit}</Text>
  </View>
);

type Tier = { word: string; color: string };

const ScoreBlock = ({ label, value, tier, hint }: { label: string; value: number; tier: Tier; hint: string }) => (
  <View style={s.scoreBlock}>
    <Text style={s.label}>{label}</Text>
    <Text style={[s.scoreValue, { color: tier.color }]}>{value.toFixed(0)}</Text>
    <View style={[s.pill, { borderColor: tier.color }]}>
      <Text style={[s.pillText, { color: tier.color }]}>{tier.word}</Text>
    </View>
    <Text style={s.hint}>{hint}</Text>
  </View>
);

const Reasons = ({ title, items }: { title: string; items: string[] }) => (
  <View style={s.reasons}>
    <Text style={s.reasonsTitle}>{title}</Text>
    {items.map((item) => <Tip key={item} text={item} />)}
  </View>
);

// Same cut-offs as FairDrive's dashboard (src/fairdrive/scoring.py).
function drivingTier(score: number): Tier {
  if (score >= 80) return { word: 'Excellent', color: C.green };
  if (score >= 60) return { word: 'Good', color: C.green };
  if (score >= 40) return { word: 'Fair', color: C.amber };
  return { word: 'Needs attention', color: C.red };
}

function conditionsTier(score: number): Tier {
  if (score >= 80) return { word: 'Easy', color: C.text };
  if (score >= 60) return { word: 'Fairly easy', color: C.text };
  if (score >= 40) return { word: 'Average', color: C.text };
  return { word: 'Demanding', color: C.text };
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: 64 },
  brand: { color: C.green, fontSize: 15, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 24 },
  page: { padding: 24, paddingBottom: 48, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  title: { color: C.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  lead: { color: C.muted, fontSize: 16, lineHeight: 23 },
  body: { color: C.text, fontSize: 16, lineHeight: 23 },
  muted: { color: C.muted, fontSize: 14 },
  meta: { color: C.muted, fontSize: 13, textAlign: 'center' },
  field: { gap: 8 },
  label: { color: C.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, color: C.text, fontSize: 17, paddingHorizontal: 16, paddingVertical: 14 },
  tips: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginTop: 8 },
  tipText: { color: C.text, fontSize: 15, lineHeight: 21, flex: 1 },
  startButton: { backgroundColor: C.green, borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  startText: { color: C.onGreen, fontSize: 18, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  recordingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2A1413', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.red },
  recordingText: { color: C.red, fontWeight: '700', fontSize: 14 },
  timer: { color: C.text, fontSize: 84, fontWeight: '200', fontVariant: ['tabular-nums'], marginVertical: 8 },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  stat: { backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, width: 100, alignItems: 'center' },
  statValue: { color: C.text, fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statUnit: { color: C.muted, fontSize: 12, marginTop: 2 },
  stopButton: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: C.text, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  stopSquare: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.red },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 20, gap: 14, borderColor: C.line, borderWidth: 1 },
  problemCard: { borderColor: '#4A2422' },
  cardTitle: { color: C.text, fontSize: 18, fontWeight: '600' },
  scoreRow: { flexDirection: 'row' },
  divider: { width: 1, backgroundColor: C.line, marginHorizontal: 8 },
  scoreBlock: { flex: 1, alignItems: 'center', gap: 6 },
  scoreValue: { fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 13, fontWeight: '600' },
  hint: { color: C.muted, fontSize: 12 },
  reasons: { gap: 10, borderTopColor: C.line, borderTopWidth: 1, paddingTop: 14 },
  reasonsTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  secondary: { flex: 1, borderColor: C.line, borderWidth: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  secondaryText: { color: C.text, fontSize: 16, fontWeight: '600' },
});
