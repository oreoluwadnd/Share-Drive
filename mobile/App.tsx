import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Moment, sendTrip, serverUrl, TripResult } from './src/fairdrive';
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
      <View style={s.center}>
        <Text style={s.bigNumber}>{live.km.toFixed(1)}</Text>
        <Text style={s.bigUnit}>km driven</Text>
        <View style={s.stats}>
          <Stat value={live.kmh.toFixed(0)} unit="km/h" />
          <Stat value={live.gpsFixes > 0 ? 'Locked' : 'Searching'} unit="GPS" />
        </View>
      </View>
      <View style={s.stopArea}>
        <Pressable onPress={onStop} style={({ pressed }) => [s.stopButton, pressed && s.pressed]}>
          <View style={s.stopSquare} />
        </Pressable>
        <Text style={s.muted}>Finish and get your score</Text>
      </View>
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
      {trips.map((trip) => trip.kind === 'scored' ? <ScoredTrip key={trip.tripId} trip={trip} /> : (
        <View key={trip.tripId} style={s.card}>
          <Text style={s.cardTitle}>Not scored · {trip.distanceKm.toFixed(1)} km</Text>
          <Text style={s.body}>{trip.why}</Text>
        </View>
      ))}
      <Buttons onSave={onSave} onNew={onNew} />
    </ScrollView>
  );
}

function ScoredTrip({ trip }: { trip: Extract<TripResult, { kind: 'scored' }> }) {
  const driving = drivingTier(trip.score.driving_score);
  return (
    <View style={s.section}>
      <View style={s.card}>
        <Text style={s.label}>Driving score · {trip.score.km} km</Text>
        <View style={s.heroRow}>
          <Text style={s.heroNumber}>{trip.score.driving_score.toFixed(0)}</Text>
          <Text style={[s.heroTier, { color: driving.color }]}>{driving.word.toUpperCase()}</Text>
        </View>
        <Text style={s.muted}>Compared with what's normal on your roads, in this light and weather. Yours to control.</Text>
      </View>

      <View style={s.tileRow}>
        <Tile label="Conditions" value={trip.score.conditions_score} note={conditionsTier(trip.score.conditions_score)} />
        <Tile label="Old score" value={trip.score.old_score} note="Ignores conditions" />
      </View>

      <Text style={s.sectionTitle}>What shaped your score</Text>
      <View style={s.card}>
        {trip.score.moments.map((moment, i) => <MomentRow key={moment.kind} moment={moment} first={i === 0} />)}
        <Text style={s.legend}>White line: what's normal for these roads, light and weather.</Text>
      </View>
      <Reasons title="In plain words" items={trip.reasons.driving_reasons} />
      <Reasons title="About the conditions" items={trip.reasons.conditions_reasons} />
    </View>
  );
}

function MomentRow({ moment, first }: { moment: Moment; first: boolean }) {
  const over = moment.count > moment.normal + 0.5;
  const scale = Math.max(moment.count, moment.normal * 2, 1);
  return (
    <View style={[s.momentRow, !first && s.momentDivider]}>
      <View style={s.momentHead}>
        <Text style={s.momentLabel}>{moment.label}</Text>
        <Text style={[s.momentValue, { color: over ? C.amber : C.green }]}>{moment.count} · normal {moment.normal.toFixed(moment.normal < 10 ? 1 : 0)}</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${(100 * moment.count) / scale}%`, backgroundColor: over ? C.amber : C.green }]} />
        <View style={[s.normalMark, { left: `${(100 * moment.normal) / scale}%` }]} />
      </View>
    </View>
  );
}

const Tile = ({ label, value, note }: { label: string; value: number; note: string }) => (
  <View style={[s.card, s.tile]}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.tileNumber}>{value.toFixed(0)}</Text>
    <Text style={s.muted}>{note}</Text>
  </View>
);

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

const Reasons = ({ title, items }: { title: string; items: string[] }) => (
  <View style={s.section}>
    <Text style={s.sectionTitle}>{title}</Text>
    <View style={[s.card, s.reasonsCard]}>
      {items.map((item) => <Tip key={item} text={item} />)}
    </View>
  </View>
);

// Same cut-offs as FairDrive's dashboard (src/fairdrive/scoring.py).
function drivingTier(score: number): Tier {
  if (score >= 80) return { word: 'Excellent', color: C.green };
  if (score >= 60) return { word: 'Good', color: C.green };
  if (score >= 40) return { word: 'Fair', color: C.amber };
  return { word: 'Needs attention', color: C.red };
}

function conditionsTier(score: number): string {
  if (score >= 80) return 'Easy roads and weather';
  if (score >= 60) return 'Fairly easy';
  if (score >= 40) return 'Average';
  return 'Demanding';
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
  recordingPage: { flex: 1, padding: 24, paddingBottom: 48 },
  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C.red, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  timerPillText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  bigNumber: { color: C.text, fontSize: 112, fontWeight: '200', fontVariant: ['tabular-nums'], letterSpacing: -4 },
  bigUnit: { color: C.muted, fontSize: 17, marginTop: -8, marginBottom: 32 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, width: 130, alignItems: 'center' },
  statValue: { color: C.text, fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statUnit: { color: C.muted, fontSize: 12, marginTop: 2 },
  stopArea: { alignItems: 'center', gap: 12 },
  stopButton: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: C.text, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.red },
  section: { gap: 12 },
  sectionTitle: { color: C.text, fontSize: 20, fontWeight: '700', marginTop: 8 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 20, gap: 8, borderColor: C.line, borderWidth: 1 },
  problemCard: { borderColor: '#4A2422' },
  cardTitle: { color: C.text, fontSize: 18, fontWeight: '600' },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  heroNumber: { color: C.text, fontSize: 88, fontWeight: '300', fontVariant: ['tabular-nums'], letterSpacing: -3 },
  heroTier: { fontSize: 16, fontWeight: '800', letterSpacing: 1.2 },
  tileRow: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 4 },
  tileNumber: { color: C.text, fontSize: 40, fontWeight: '300', fontVariant: ['tabular-nums'] },
  momentRow: { gap: 10, paddingVertical: 10 },
  momentDivider: { borderTopColor: C.line, borderTopWidth: 1 },
  momentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  momentLabel: { color: C.text, fontSize: 16, fontWeight: '600' },
  momentValue: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: C.line },
  fill: { height: 6, borderRadius: 3 },
  normalMark: { position: 'absolute', top: -4, width: 2, height: 14, borderRadius: 1, backgroundColor: C.text },
  reasonsCard: { gap: 12 },
  legend: { color: C.muted, fontSize: 13, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  secondary: { flex: 1, borderColor: C.line, borderWidth: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  secondaryText: { color: C.text, fontSize: 16, fontWeight: '600' },
});
