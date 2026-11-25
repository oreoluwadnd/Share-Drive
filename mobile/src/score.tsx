// A scored trip: the ring, the tiles, each kind of harsh moment against normal, and the reasons.
// Used by the driver's results screen and the admin trip page.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Moment, Reasons as TripReasons, Score } from './fairdrive';
import { ScoreRing, SlideIn } from './motion';
import { T } from './theme';
import { Chip, conditionsWord, drivingTier, IconName, ui } from './ui';

export function ScoredTrip({ score, reasons }: { score: Score; reasons: TripReasons }) {
  const tier = drivingTier(score.driving_score);
  const headline = headlineFor(score.moments);
  return (
    <View style={ui.section}>
      <SlideIn delay={0}>
        <View style={[ui.card, s.hero]}>
          <LinearGradient colors={[`${T.ring[tier.level][0]}22`, '#FFFFFF00']} style={StyleSheet.absoluteFill} />
          <ScoreRing value={score.driving_score} colors={T.ring[tier.level]} word={tier.word} />
          <Text style={s.headline}>{headline.title}</Text>
          <Text style={[ui.muted, ui.centerText]}>{headline.detail}</Text>
          <View style={s.chipRow}>
            <Chip icon="map-marker-distance" text={`${score.km} km`} />
            <Chip icon="road-variant" text={conditionsWord(score.conditions_score)} />
          </View>
        </View>
      </SlideIn>

      <SlideIn delay={150}>
        <View style={s.tileRow}>
          <Tile icon="weather-partly-cloudy" label="Conditions" value={score.conditions_score} note="100 = easiest" />
          <Tile icon="history" label="Old score" value={score.old_score} note="Ignores conditions" />
        </View>
      </SlideIn>

      <SlideIn delay={300}>
        <Text style={ui.sectionTitle}>What shaped your score</Text>
        <View style={[ui.card, s.gapTop]}>
          {score.moments.map((moment, i) => <MomentRow key={moment.kind} moment={moment} first={i === 0} />)}
          <Text style={s.legend}>The black line marks what's normal for these roads, light and weather.</Text>
        </View>
      </SlideIn>

      <SlideIn delay={450}>
        <Reasons title="In plain words" items={reasons.driving_reasons.map((text) => ({ text, icon: isGood(text) ? 'check-circle' : 'alert-circle', color: isGood(text) ? T.ring.good[0] : T.ring.fair[0] }))} />
      </SlideIn>
      <SlideIn delay={600}>
        <Reasons title="About the conditions" items={reasons.conditions_reasons.map((text, i) => ({ text, icon: conditionIcon(text, i), color: T.muted }))} />
      </SlideIn>
    </View>
  );
}

const MOMENT_ICONS: Record<string, IconName> = { hard_brake: 'car-brake-alert', hard_accel: 'speedometer', hard_corner: 'steering' };

export function MomentRow({ moment, first }: { moment: Moment; first: boolean }) {
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
          <Text style={ui.muted}>  normal {moment.normal.toFixed(moment.normal < 10 ? 1 : 0)}</Text>
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

const Tile = ({ icon, label, value, note }: { icon: IconName; label: string; value: number; note: string }) => (
  <View style={[ui.card, s.tile]}>
    <View style={s.tileHead}>
      <MaterialCommunityIcons name={icon} size={18} color={T.muted} />
      <Text style={ui.label}>{label}</Text>
    </View>
    <Text style={s.tileNumber}>{value.toFixed(0)}</Text>
    <Text style={ui.muted}>{note}</Text>
  </View>
);

const Reasons = ({ title, items }: { title: string; items: { text: string; icon: IconName; color: string }[] }) => (
  <View style={ui.section}>
    <Text style={ui.sectionTitle}>{title}</Text>
    <View style={[ui.card, ui.tips]}>
      {items.map((item) => (
        <View key={item.text} style={ui.tip}>
          <MaterialCommunityIcons name={item.icon} size={20} color={item.color} style={s.reasonIcon} />
          <Text style={ui.tipText}>{item.text}</Text>
        </View>
      ))}
    </View>
  </View>
);

const s = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 28, gap: 10, overflow: 'hidden' },
  headline: { color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  gapTop: { marginTop: 12 },
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
});
