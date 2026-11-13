import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Moment, sendTrip, serverUrl, TripResult } from './src/fairdrive';
import { Live, Recorder } from './src/recorder';
import { DrivingRoad, ScoreRing, SlideIn } from './src/motion';
import { T } from './src/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

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
    <LinearGradient colors={T.background} style={s.root}>
      <StatusBar style="dark" />
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
    </LinearGradient>
  );
}

function Ready(p: { driver: string; server: string; onDriver: (t: string) => void; onServer: (t: string) => void; onStart: () => void }) {
  const canStart = p.driver.trim() !== '' && p.server.trim() !== '';
  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Ready to drive</Text>
      <Text style={s.lead}>Your score compares you with what's normal for your roads, light and weather.</Text>
      <DrivingRoad kmh={20} />

      <View style={s.card}>
        <Field label="Driver name" value={p.driver} onChange={p.onDriver} placeholder="e.g. Ana" />
        <View style={s.cardDivider} />
        <Field label="FairDrive server" value={p.server} onChange={p.onServer} placeholder="192.168.1.20:8000" keyboard="url" />
      </View>

      <View style={[s.card, s.tips]}>
        <Tip text="Mount the phone firmly. Any angle works, but it mustn't move." />
        <Tip text="Keep this screen open. The phone stays awake while recording." />
        <Tip text="Drive at least 3 km so there's something to score." />
      </View>

      <PrimaryButton label="Start drive" disabled={!canStart} onPress={p.onStart} />
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
        <View style={s.roadWide}><DrivingRoad kmh={live.kmh} /></View>
        <Text style={s.bigNumber}>{live.km.toFixed(1)}</Text>
        <Text style={s.bigUnit}>km driven</Text>
        <View style={s.statRow}>
          <View style={[s.card, s.stat]}>
            <Text style={s.statValue}>{live.kmh.toFixed(0)}</Text>
            <Text style={s.muted}>km/h</Text>
          </View>
          <View style={[s.card, s.stat]}>
            <Text style={s.statValue}>{live.gpsFixes > 0 ? 'Locked' : 'Searching'}</Text>
            <Text style={s.muted}>GPS</Text>
          </View>
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
      <View style={s.roadWide}><DrivingRoad kmh={60} /></View>
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
  const tier = drivingTier(trip.score.driving_score);
  const headline = headlineFor(trip.score.moments);
  return (
    <View style={s.section}>
      <SlideIn delay={0}>
        <View style={[s.card, s.hero]}>
          <LinearGradient colors={[`${T.ring[tier.level][0]}22`, '#FFFFFF00']} style={StyleSheet.absoluteFill} />
          <ScoreRing value={trip.score.driving_score} colors={T.ring[tier.level]} word={tier.word} />
          <Text style={s.headline}>{headline.title}</Text>
          <Text style={[s.muted, s.centerText]}>{headline.detail}</Text>
          <View style={s.chipRow}>
            <Chip icon="map-marker-distance" text={`${trip.score.km} km`} />
            <Chip icon="road-variant" text={conditionsWord(trip.score.conditions_score)} />
          </View>
        </View>
      </SlideIn>

      <SlideIn delay={150}>
        <View style={s.tileRow}>
          <Tile icon="weather-partly-cloudy" label="Conditions" value={trip.score.conditions_score} note="100 = easiest" />
          <Tile icon="history" label="Old score" value={trip.score.old_score} note="Ignores conditions" />
        </View>
      </SlideIn>

      <SlideIn delay={300}>
        <Text style={s.sectionTitle}>What shaped your score</Text>
        <View style={[s.card, s.gapTop]}>
          {trip.score.moments.map((moment, i) => <MomentRow key={moment.kind} moment={moment} first={i === 0} />)}
          <Text style={s.legend}>The black line marks what's normal for these roads, light and weather.</Text>
        </View>
      </SlideIn>

      <SlideIn delay={450}>
        <Reasons title="In plain words" items={trip.reasons.driving_reasons.map((text) => ({ text, icon: isGood(text) ? 'check-circle' : 'alert-circle', color: isGood(text) ? T.ring.good[0] : T.ring.fair[0] }))} />
      </SlideIn>
      <SlideIn delay={600}>
        <Reasons title="About the conditions" items={trip.reasons.conditions_reasons.map((text, i) => ({ text, icon: conditionIcon(text, i), color: T.muted }))} />
      </SlideIn>
    </View>
  );
}

const MOMENT_ICONS: Record<string, IconName> = { hard_brake: 'car-brake-alert', hard_accel: 'speedometer', hard_corner: 'steering' };

function MomentRow({ moment, first }: { moment: Moment; first: boolean }) {
  const over = moment.count > moment.normal + 0.5;
  const colors = over ? T.ring.fair : T.ring.good;
  const scale = Math.max(moment.count, moment.normal * 2, 1);
  return (
    <View style={[s.momentRow, !first && s.momentDivider]}>
      <View style={s.momentHead}>
        <View style={[s.iconBubble, { backgroundColor: `${colors[0]}1F` }]}>
          <MaterialCommunityIcons name={MOMENT_ICONS[moment.kind]} size={20} color={colors[0]} />
        </View>
        <Text style={s.momentLabel}>{moment.label}</Text>
        <Text style={s.momentValue}>
          <Text style={{ color: colors[0], fontWeight: '800' }}>{moment.count}</Text>
          <Text style={s.muted}>  normal {moment.normal.toFixed(moment.normal < 10 ? 1 : 0)}</Text>
        </Text>
      </View>
      <View style={s.track}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fill, { width: `${(100 * moment.count) / scale}%` }]} />
        <View style={[s.normalMark, { left: `${(100 * moment.normal) / scale}%` }]} />
      </View>
    </View>
  );
}

const MOMENT_ADVICE: Record<string, { title: string; noun: string }> = {
  hard_brake: { title: 'Watch your braking', noun: 'hard brakes' },
  hard_accel: { title: 'Ease off when speeding up', noun: 'sharp starts' },
  hard_corner: { title: 'Take turns more gently', noun: 'sharp turns' },
};

/** One line on top of the score: the kind of harsh moment furthest above normal, or praise if none is. */
function headlineFor(moments: Moment[]): { title: string; detail: string } {
  const worst = moments.filter((m) => m.count > m.normal + 0.5).sort((a, b) => (b.count - b.normal) - (a.count - a.normal))[0];
  if (!worst) return { title: 'Smooth, steady drive', detail: 'Every kind of harsh moment was at or below normal for these conditions.' };
  const advice = MOMENT_ADVICE[worst.kind];
  return { title: advice.title, detail: `${worst.count} ${advice.noun} where about ${Math.round(worst.normal)} is normal here.` };
}

const isGood = (reason: string) => /normal or better|needs no change|never/.test(reason);

function conditionIcon(reason: string, index: number): IconName {
  if (index === 0) return 'gauge';
  if (index === 1) return 'road-variant';
  return reason.includes('in the dark') ? 'weather-night' : 'white-balance-sunny';
}

const Chip = ({ icon, text }: { icon: IconName; text: string }) => (
  <View style={s.chip}>
    <MaterialCommunityIcons name={icon} size={16} color={T.muted} />
    <Text style={s.chipText}>{text}</Text>
  </View>
);

function Problem(p: { message: string; onRetry?: () => void; onSave?: () => void; onNew: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.title}>Something went wrong</Text>
      <View style={s.card}>
        <Text style={s.body}>{p.message}</Text>
      </View>
      {p.onRetry && <PrimaryButton label="Send again" onPress={p.onRetry} />}
      <Buttons onSave={p.onSave} onNew={p.onNew} />
    </ScrollView>
  );
}

function Buttons({ onSave, onNew }: { onSave?: () => void; onNew: () => void }) {
  return (
    <View style={s.buttonRow}>
      {onSave && (
        <Pressable onPress={onSave} style={({ pressed }) => [s.card, s.secondary, pressed && s.pressed]}>
          <Text style={s.secondaryText}>Save recording</Text>
        </Pressable>
      )}
      <Pressable onPress={onNew} style={({ pressed }) => [s.card, s.secondary, pressed && s.pressed]}>
        <Text style={s.secondaryText}>New drive</Text>
      </Pressable>
    </View>
  );
}

const PrimaryButton = ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) => (
  <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [s.primary, disabled && s.disabled, pressed && s.pressed]}>
    <Text style={s.primaryText}>{label}</Text>
  </Pressable>
);

function Field(p: { label: string; value: string; onChange: (t: string) => void; placeholder: string; keyboard?: 'url' }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{p.label}</Text>
      <TextInput
        style={s.input} value={p.value} onChangeText={p.onChange} placeholder={p.placeholder}
        placeholderTextColor={T.faint} autoCapitalize="none" autoCorrect={false} keyboardType={p.keyboard ?? 'default'}
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

const Tile = ({ icon, label, value, note }: { icon: IconName; label: string; value: number; note: string }) => (
  <View style={[s.card, s.tile]}>
    <View style={s.tileHead}>
      <MaterialCommunityIcons name={icon} size={18} color={T.muted} />
      <Text style={s.label}>{label}</Text>
    </View>
    <Text style={s.tileNumber}>{value.toFixed(0)}</Text>
    <Text style={s.muted}>{note}</Text>
  </View>
);

const Reasons = ({ title, items }: { title: string; items: { text: string; icon: IconName; color: string }[] }) => (
  <View style={s.section}>
    <Text style={s.sectionTitle}>{title}</Text>
    <View style={[s.card, s.tips]}>
      {items.map((item) => (
        <View key={item.text} style={s.tip}>
          <MaterialCommunityIcons name={item.icon} size={20} color={item.color} style={s.reasonIcon} />
          <Text style={s.tipText}>{item.text}</Text>
        </View>
      ))}
    </View>
  </View>
);

// Same cut-offs as FairDrive's dashboard (src/fairdrive/scoring.py).
function drivingTier(score: number): { word: string; level: 'good' | 'fair' | 'poor' } {
  if (score >= 80) return { word: 'Excellent', level: 'good' };
  if (score >= 60) return { word: 'Good', level: 'good' };
  if (score >= 40) return { word: 'Fair', level: 'fair' };
  return { word: 'Needs attention', level: 'poor' };
}

function conditionsWord(score: number): string {
  if (score >= 80) return 'Easy';
  if (score >= 60) return 'Fairly easy';
  if (score >= 40) return 'Average';
  return 'Demanding';
}

const s = StyleSheet.create({
  root: { flex: 1, paddingTop: 64 },
  brand: { color: T.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.4, paddingHorizontal: 20, opacity: 0.9 },
  page: { padding: 20, paddingBottom: 48, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  title: { color: T.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  lead: { color: T.muted, fontSize: 16, lineHeight: 23 },
  body: { color: T.text, fontSize: 16, lineHeight: 23 },
  muted: { color: T.muted, fontSize: 14, lineHeight: 20 },
  label: { color: T.muted, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: T.card, borderRadius: 28, padding: 20, gap: 8, ...T.cardShadow },
  cardDivider: { height: 1, backgroundColor: T.track, marginVertical: 8 },
  cardTitle: { color: T.text, fontSize: 18, fontWeight: '700' },
  field: { gap: 6 },
  input: { color: T.text, fontSize: 18, fontWeight: '600', paddingVertical: 4 },
  tips: { gap: 12 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.ring.good[0], marginTop: 8 },
  tipText: { color: T.text, fontSize: 15, lineHeight: 21, flex: 1 },
  primary: { backgroundColor: T.primary, borderRadius: 999, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  primaryText: { color: T.onPrimary, fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  recordingPage: { flex: 1, padding: 20, paddingBottom: 48 },
  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: T.record, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  timerPillText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  bigNumber: { color: T.text, fontSize: 120, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -6 },
  bigUnit: { color: T.muted, fontSize: 17, fontWeight: '600', marginTop: -10, marginBottom: 32 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { width: 140, alignItems: 'center', gap: 2 },
  statValue: { color: T.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stopArea: { alignItems: 'center', gap: 12 },
  stopButton: { width: 92, height: 92, borderRadius: 46, backgroundColor: T.record, alignItems: 'center', justifyContent: 'center', ...T.cardShadow },
  stopSquare: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFFFFF' },
  section: { gap: 12 },
  sectionTitle: { color: T.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  hero: { alignItems: 'center', paddingVertical: 28, gap: 10, overflow: 'hidden' },
  headline: { color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.track, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: T.text, fontSize: 13, fontWeight: '600' },
  gapTop: { marginTop: 12 },
  roadWide: { alignSelf: 'stretch', marginBottom: 24 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBubble: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  reasonIcon: { marginTop: 1 },
  tileRow: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 2 },
  tileNumber: { color: T.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  momentRow: { gap: 10, paddingVertical: 10 },
  momentDivider: { borderTopColor: T.track, borderTopWidth: 1 },
  momentHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  momentLabel: { color: T.text, fontSize: 16, fontWeight: '700', flex: 1 },
  momentValue: { fontSize: 16, fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, backgroundColor: T.track },
  fill: { height: 10, borderRadius: 5 },
  normalMark: { position: 'absolute', top: -4, width: 3, height: 18, borderRadius: 2, backgroundColor: T.text },
  legend: { color: T.muted, fontSize: 13, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  secondary: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  secondaryText: { color: T.text, fontSize: 16, fontWeight: '700' },
});
