// Pieces of a trip shared by the phone app and the admin dashboard: the route drawing, score badge, avatar and dates.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { FONT } from './brand';
import { Phone } from './fairdrive';
import { T } from './theme';
import { drivingTier, ui } from './ui';

export function RouteCard({ route }: { route: [number, number][] }) {
  const size = { w: 320, h: 260, pad: 18 };
  const shape = useMemo(() => {
    if (route.length < 2) return null;
    const meanLat = (route.reduce((sum, [lat]) => sum + lat, 0) / route.length) * (Math.PI / 180);
    const xy = route.map(([lat, lon]) => [lon * Math.cos(meanLat), -lat]);
    const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
    const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
    const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
    const scale = Math.min(size.w, size.h) - 2 * size.pad;
    const offX = (size.w - ((Math.max(...xs) - x0) / span) * scale) / 2, offY = (size.h - ((Math.max(...ys) - y0) / span) * scale) / 2;
    return xy.map(([x, y]) => [offX + ((x - x0) / span) * scale, offY + ((y - y0) / span) * scale]);
  }, [route]);

  return (
    <View style={ui.card}>
      <View style={s.head}>
        <MaterialCommunityIcons name="map-marker-path" size={18} color={T.muted} />
        <Text style={ui.label}>Route</Text>
      </View>
      {shape ? (
        <>
          <Svg width="100%" height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
            <Polyline points={shape.map((p) => p.join(',')).join(' ')} fill="none" stroke={T.text} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={shape[0][0]} cy={shape[0][1]} r={7} fill={T.ring.good[0]} stroke="#FFFFFF" strokeWidth={3} />
            <Circle cx={shape.at(-1)![0]} cy={shape.at(-1)![1]} r={7} fill={T.record} stroke="#FFFFFF" strokeWidth={3} />
          </Svg>
          <View style={s.legendRow}>
            <Dot color={T.ring.good[0]} label="Start" />
            <Dot color={T.record} label="End" />
          </View>
          <Text style={ui.muted}>The first and last 500 m are hidden, so homes and workplaces stay private.</Text>
        </>
      ) : <Text style={ui.muted}>No route is kept for trips that couldn't be scored.</Text>}
    </View>
  );
}

export function ScoreBadge({ score, withWord }: { score: number; withWord: boolean }) {
  const tier = drivingTier(score);
  const color = T.ring[tier.level][0];
  return (
    <View style={[s.badge, { backgroundColor: `${color}1F` }]}>
      <Text style={[s.badgeNumber, { color }]}>{score.toFixed(0)}</Text>
      {withWord && <Text style={[s.badgeWord, { color }]} numberOfLines={1}>{tier.word}</Text>}
    </View>
  );
}

export const NotScoredBadge = () => (
  <View style={s.notScored}><Text style={s.notScoredText} numberOfLines={1}>Not scored</Text></View>
);

const AVATAR_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#0EA5E9', '#14B8A6'];

export function Avatar({ name, big }: { name: string; big?: boolean }) {
  const color = AVATAR_COLORS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <View style={[s.avatar, big && s.avatarBig, { backgroundColor: `${color}26` }]}>
      <Text style={[s.avatarText, big && s.avatarTextBig, { color }]}>{name.replace(/^uah-/, '').slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

const Dot = ({ color, label }: { color: string; label: string }) => (
  <View style={s.dotItem}>
    <View style={[s.dot, { backgroundColor: color }]} />
    <Text style={ui.muted}>{label}</Text>
  </View>
);

export const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
export const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' });
export const phoneName = (phone: NonNullable<Phone>) => `${phone.device} (${phone.platform === 'ios' ? 'iOS' : 'Android'})`;
export const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.');

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendRow: { flexDirection: 'row', gap: 16 },
  dotItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  badge: { flexDirection: 'row', alignItems: 'baseline', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeNumber: { fontSize: 18, fontFamily: FONT.head, fontVariant: ['tabular-nums'] },
  badgeWord: { fontSize: 12, fontFamily: FONT.bodyBold },
  notScored: { backgroundColor: T.track, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  notScoredText: { color: T.muted, fontSize: 13, fontFamily: FONT.bodyBold },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarBig: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { fontSize: 14, fontFamily: FONT.head },
  avatarTextBig: { fontFamily: FONT.body, fontSize: 22 },
});
