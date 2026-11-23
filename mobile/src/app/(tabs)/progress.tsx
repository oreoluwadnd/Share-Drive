// The Progress tab: your driving score over time, and which kinds of harsh moment are getting better.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Moment, TripRow } from '../../fairdrive';
import { DrivingRoad } from '../../motion';
import { Page } from '../../page';
import { T } from '../../theme';
import { average, when } from '../../trip-parts';
import { drivingTier, IconName, PrimaryButton, ui } from '../../ui';
import { useMyTrips } from '../../use-my-trips';

type Scored = Extract<TripRow, { scored: true }>;
const RECENT = 5; // "recent" = your last 5 scored drives, compared with the ones before
const CHART_DRIVES = 12;

export default function Progress() {
  const { trips, error, refreshing, refresh } = useMyTrips();
  const scored = (trips ?? []).filter((t): t is Scored => t.scored).reverse(); // oldest first

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Text style={ui.title}>Progress</Text>
      {error !== '' && <Text style={ui.error}>{error}</Text>}
      {trips === null && error === '' && <ActivityIndicator color={T.text} style={s.loading} />}
      {trips !== null && scored.length < 2 && (
        <View style={[ui.card, s.empty]}>
          <DrivingRoad kmh={20} />
          <Text style={ui.cardTitle}>Your progress starts after 2 scored drives</Text>
          <Text style={[ui.muted, ui.centerText]}>
            {scored.length === 0 ? 'No scored drives yet.' : 'One scored drive so far.'} Drives of 3 km or more get a score.
          </Text>
          <PrimaryButton label="Start a drive" onPress={() => router.navigate('/drive')} />
        </View>
      )}
      {scored.length >= 2 && (
        <>
          <Headline scored={scored} />
          <ScoreChart scored={scored.slice(-CHART_DRIVES)} />
          <Moments scored={scored} />
          <View style={s.totals}>
            <Total label="Drives" value={String(trips!.length)} />
            <Total label="Scored" value={String(scored.length)} />
            <Total label="Km" value={trips!.reduce((sum, t) => sum + t.distance_km, 0).toFixed(0)} />
          </View>
        </>
      )}
    </Page>
  );
}

function Headline({ scored }: { scored: Scored[] }) {
  const recent = average(scored.slice(-RECENT).map((t) => t.driving_score));
  const earlier = scored.length > RECENT ? average(scored.slice(0, -RECENT).map((t) => t.driving_score)) : null;
  const change = earlier === null ? null : Math.round(recent - earlier);
  return (
    <View style={[ui.card, s.headline]}>
      <Text style={ui.label}>Average driving score, last {Math.min(RECENT, scored.length)} drives</Text>
      <View style={s.headlineRow}>
        <Text style={s.big}>{recent.toFixed(0)}</Text>
        <Text style={[s.tier, { color: T.ring[drivingTier(recent).level][0] }]}>{drivingTier(recent).word}</Text>
      </View>
      {change !== null && (
        <Trend
          icon={change > 0 ? 'arrow-up' : change < 0 ? 'arrow-down' : 'minus'}
          color={change > 0 ? T.ring.good[0] : change < 0 ? T.ring.fair[0] : T.muted}
          text={change === 0 ? 'Same as your earlier drives' : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} from your earlier drives`}
        />
      )}
    </View>
  );
}

function ScoreChart({ scored }: { scored: Scored[] }) {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState(scored.length - 1);
  const h = 170, left = 30, right = 14, top = 16, bottom = 12;
  const x = (i: number) => left + (i * (width - left - right)) / (scored.length - 1);
  const y = (score: number) => top + ((100 - score) / 100) * (h - top - bottom);
  const trip = scored[Math.min(picked, scored.length - 1)];

  return (
    <View style={ui.card}>
      <Text style={ui.cardTitle}>Driving score by drive</Text>
      <Text style={ui.muted}>{when(trip.start)} · <Text style={s.pickedValue}>{trip.driving_score.toFixed(0)}</Text>. Tap a dot to see another drive.</Text>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={h}>
            {[0, 50, 100].map((v) => (
              <Fragment key={v}>
                <Line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke={T.track} strokeWidth={1} />
                <SvgText x={0} y={y(v) + 4} fontSize={11} fill={T.muted}>{v}</SvgText>
              </Fragment>
            ))}
            <Polyline points={scored.map((t, i) => `${x(i)},${y(t.driving_score)}`).join(' ')} fill="none" stroke={T.ring.good[0]} strokeWidth={2} strokeLinejoin="round" />
            {scored.map((t, i) => (
              <Circle key={t.trip_id} cx={x(i)} cy={y(t.driving_score)} r={i === picked ? 6 : 4} fill={i === picked ? T.text : T.ring.good[0]} stroke={T.card} strokeWidth={2} />
            ))}
            {scored.map((t, i) => (
              <Circle key={`hit-${t.trip_id}`} cx={x(i)} cy={y(t.driving_score)} r={18} fill="transparent" onPress={() => setPicked(i)} />
            ))}
          </Svg>
        )}
      </View>
      <View style={s.axisRow}>
        <Text style={ui.muted}>Older</Text>
        <Text style={ui.muted}>Latest</Text>
      </View>
    </View>
  );
}

function Moments({ scored }: { scored: Scored[] }) {
  const recent = scored.slice(-RECENT);
  const earlier = scored.length > RECENT ? scored.slice(0, -RECENT) : null;
  return (
    <View style={ui.section}>
      <Text style={ui.sectionTitle}>Harsh moments</Text>
      <Text style={ui.muted}>Compared with what's normal on the same roads, in the same light and weather. 1.0× is normal.</Text>
      <View style={[ui.card, s.moments]}>
        {recent[0].moments.map((m, i) => {
          const now = timesNormal(recent, m.kind);
          const before = earlier && timesNormal(earlier, m.kind);
          return (
            <View key={m.kind} style={[s.momentRow, i > 0 && s.divider]}>
              <View style={s.flex}>
                <Text style={s.momentLabel}>{m.label}</Text>
                {before === null ? <Text style={ui.muted}>Over your last {recent.length} drives</Text> : <MomentTrend now={now} before={before} />}
              </View>
              <Text style={s.times}>{now.toFixed(1)}×</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MomentTrend({ now, before }: { now: number; before: number }) {
  if (now < before - 0.1) return <Trend icon="trending-down" color={T.ring.good[0]} text={`Getting better (was ${before.toFixed(1)}×)`} />;
  if (now > before + 0.1) return <Trend icon="trending-up" color={T.ring.fair[0]} text={`More than before (was ${before.toFixed(1)}×)`} />;
  return <Trend icon="minus" color={T.muted} text="Steady" />;
}

/** All harsh moments of one kind over these drives, divided by the number that would be normal for them. */
function timesNormal(trips: Scored[], kind: string): number {
  const pick = (t: Scored) => t.moments.find((m) => m.kind === kind) as Moment;
  const normal = trips.reduce((sum, t) => sum + pick(t).normal, 0);
  return trips.reduce((sum, t) => sum + pick(t).count, 0) / normal;
}

const Trend = ({ icon, color, text }: { icon: IconName; color: string; text: string }) => (
  <View style={s.trend}>
    <MaterialCommunityIcons name={icon} size={16} color={color} />
    <Text style={ui.muted}>{text}</Text>
  </View>
);

const Total = ({ label, value }: { label: string; value: string }) => (
  <View style={[ui.card, s.total]}>
    <Text style={s.totalValue}>{value}</Text>
    <Text style={ui.muted}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  loading: { marginTop: 40 },
  empty: { alignItems: 'center', gap: 12 },
  headline: { gap: 4 },
  headlineRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  big: { color: T.text, fontSize: 64, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  tier: { fontSize: 18, fontWeight: '800' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickedValue: { color: T.text, fontWeight: '800' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 30 },
  moments: { paddingVertical: 8 },
  momentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: T.track },
  flex: { flex: 1, gap: 4 },
  momentLabel: { color: T.text, fontSize: 16, fontWeight: '700' },
  times: { color: T.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  totals: { flexDirection: 'row', gap: 12 },
  total: { flex: 1, alignItems: 'center', gap: 2 },
  totalValue: { color: T.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
