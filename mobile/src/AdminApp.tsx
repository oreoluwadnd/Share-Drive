// The web dashboard: admins log in and see every trip uploaded to FairDrive.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { getTrip, listTrips, LoggedOut, login, Phone, Session, TripDetail, TripRow } from './admin-api';
import { serverUrl } from './fairdrive';
import { DrivingRoad } from './motion';
import { ScoredTrip } from './score';
import { T } from './theme';
import { Chip, drivingTier, Field, IconName, PrimaryButton, ui } from './ui';

const WIDE = 900;

export default function AdminApp({ onHome }: { onHome: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [openTrip, setOpenTrip] = useState<string | null>(null);
  const logOut = () => { setSession(null); setOpenTrip(null); };

  return (
    <LinearGradient colors={T.background} style={s.root}>
      {!session ? <Login onLogin={setSession} onHome={onHome} /> : (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.frame}>
            <TopBar email={session.email} onLogOut={logOut} onHome={onHome} />
            {openTrip
              ? <TripPage session={session} tripId={openTrip} onBack={() => setOpenTrip(null)} onLoggedOut={logOut} />
              : <TripsPage session={session} onOpen={setOpenTrip} onLoggedOut={logOut} />}
          </View>
        </ScrollView>
      )}
    </LinearGradient>
  );
}

function Login({ onLogin, onHome }: { onLogin: (session: Session) => void; onHome: () => void }) {
  const [server, setServer] = useState('localhost:8000');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = server.trim() !== '' && email.trim() !== '' && password !== '' && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      onLogin(await login(serverUrl(server), email.trim(), password));
    } catch (e) {
      setError(e instanceof TypeError ? "Can't reach the FairDrive server. Check the address and that `fairdrive api` is running." : (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[ui.page, s.loginPage]}>
      <View style={s.loginBox}>
        <Pressable onPress={onHome} style={({ pressed }) => [s.back, pressed && ui.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={18} color={T.text} />
          <Text style={s.ghostText}>Back to FairDrive</Text>
        </Pressable>
        <View style={s.brandRow}>
          <Text style={s.brand}>FairDrive</Text>
          <View style={s.adminPill}><Text style={s.adminPillText}>Admin</Text></View>
        </View>
        <Text style={ui.title}>Log in</Text>
        <Text style={ui.lead}>See every trip drivers have uploaded, with their scores and reasons.</Text>
        <DrivingRoad kmh={30} />
        <View style={ui.card}>
          <Field label="FairDrive server" value={server} onChange={setServer} placeholder="localhost:8000" keyboard="url" />
          <View style={ui.cardDivider} />
          <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" onSubmit={submit} />
          <View style={ui.cardDivider} />
          <Field label="Password" value={password} onChange={setPassword} placeholder="Your password" secret onSubmit={submit} />
        </View>
        {error !== '' && <Text style={ui.error}>{error}</Text>}
        <PrimaryButton label={busy ? 'Logging in…' : 'Log in'} disabled={!ready} onPress={submit} />
        <Text style={[ui.muted, ui.centerText]}>No account? An admin is added on the server with{'\n'}uv run fairdrive add-admin you@example.com</Text>
      </View>
    </ScrollView>
  );
}

function TopBar({ email, onLogOut, onHome }: { email: string; onLogOut: () => void; onHome: () => void }) {
  return (
    <View style={s.topBar}>
      <Pressable onPress={onHome} style={s.brandRow}>
        <Text style={s.brand}>FairDrive</Text>
        <View style={s.adminPill}><Text style={s.adminPillText}>Admin</Text></View>
      </Pressable>
      <View style={s.topRight}>
        <Text style={ui.muted}>{email}</Text>
        <Pressable onPress={onLogOut} style={({ pressed }) => [s.ghostButton, pressed && ui.pressed]}>
          <MaterialCommunityIcons name="logout" size={16} color={T.text} />
          <Text style={s.ghostText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TripsPage({ session, onOpen, onLoggedOut }: { session: Session; onOpen: (id: string) => void; onLoggedOut: () => void }) {
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [error, setError] = useState('');
  const [driver, setDriver] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  async function load() {
    setError('');
    try {
      setTrips(await listTrips(session));
    } catch (e) {
      if (e instanceof LoggedOut) onLoggedOut();
      else setError((e as Error).message);
    }
  }
  useEffect(() => { load(); }, []);

  const drivers = useMemo(() => [...new Set((trips ?? []).map((t) => t.driver))].sort(), [trips]);
  const shown = (trips ?? []).filter((t) => driver === null || t.driver === driver);
  const scored = shown.filter((t) => t.scored);

  return (
    <View style={ui.section}>
      <View style={s.headRow}>
        <View style={s.flex}>
          <Text style={ui.title}>All trips</Text>
          <Text style={ui.lead}>Every drive uploaded to FairDrive, newest first.</Text>
        </View>
        <Pressable onPress={load} style={({ pressed }) => [s.ghostButton, pressed && ui.pressed]}>
          <MaterialCommunityIcons name="refresh" size={16} color={T.text} />
          <Text style={s.ghostText}>Refresh</Text>
        </Pressable>
      </View>

      {error !== '' && <Text style={ui.error}>{error}</Text>}
      {trips === null && error === '' && <ActivityIndicator color={T.text} style={s.loading} />}

      {trips !== null && (
        <>
          <View style={s.statRow}>
            <Stat icon="car-side" label="Trips" value={String(shown.length)} />
            <Stat icon="account-group" label="Drivers" value={String(new Set(shown.map((t) => t.driver)).size)} />
            <Stat icon="map-marker-distance" label="Km driven" value={shown.reduce((sum, t) => sum + t.distance_km, 0).toFixed(0)} />
            <Stat icon="gauge" label="Average driving score" value={scored.length ? average(scored.map((t) => t.driving_score!)).toFixed(0) : '–'} />
          </View>

          <View style={s.filterRow}>
            <FilterChip label="All drivers" active={driver === null} onPress={() => setDriver(null)} />
            {drivers.map((d) => <FilterChip key={d} label={d} active={driver === d} onPress={() => setDriver(d)} />)}
          </View>

          <View style={[ui.card, s.table]}>
            {width >= WIDE && (
              <View style={[s.row, s.headerRow]}>
                <Text style={[s.th, s.colTrip]}>Trip</Text>
                <Text style={[s.th, s.colNum]}>Km</Text>
                <Text style={[s.th, s.colScore, s.right]}>Driving</Text>
                <Text style={[s.th, s.colNum]}>Conditions</Text>
                <Text style={[s.th, s.colNum]}>Old score</Text>
              </View>
            )}
            {shown.length === 0 && <Text style={[ui.muted, s.empty]}>No trips yet. They appear here once drivers upload them.</Text>}
            {shown.map((trip, i) => <TripLine key={trip.trip_id} trip={trip} wide={width >= WIDE} first={i === 0} onPress={() => onOpen(trip.trip_id)} />)}
          </View>
        </>
      )}
    </View>
  );
}

function TripLine({ trip, wide, first, onPress }: { trip: TripRow; wide: boolean; first: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.row, !first && s.rowDivider, (pressed || hovered) && s.rowHover]}>
      <View style={[s.colTrip, s.tripCell]}>
        <Avatar name={trip.driver} />
        <View style={s.flex}>
          <Text style={s.driver}>{trip.driver}</Text>
          <Text style={ui.muted}>{when(trip.start)}{trip.phone ? ` · ${phoneName(trip.phone)}` : ''}{wide ? '' : ` · ${trip.distance_km.toFixed(1)} km`}</Text>
        </View>
      </View>
      {wide && <Text style={[s.td, s.colNum]}>{trip.distance_km.toFixed(1)}</Text>}
      <View style={wide ? s.colScore : undefined}>
        {trip.scored ? <ScoreBadge score={trip.driving_score!} withWord={wide} /> : (
          <View style={s.notScored}><Text style={s.notScoredText} numberOfLines={1}>Not scored</Text></View>
        )}
      </View>
      {wide && <Text style={[s.td, s.colNum]}>{trip.scored ? trip.conditions_score!.toFixed(0) : '–'}</Text>}
      {wide && <Text style={[s.td, s.colNum]}>{trip.scored ? trip.old_score!.toFixed(0) : '–'}</Text>}
    </Pressable>
  );
}

function TripPage({ session, tripId, onBack, onLoggedOut }: { session: Session; tripId: string; onBack: () => void; onLoggedOut: () => void }) {
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();

  useEffect(() => {
    getTrip(session, tripId).then(setTrip).catch((e) => (e instanceof LoggedOut ? onLoggedOut() : setError((e as Error).message)));
  }, [tripId]);

  return (
    <View style={ui.section}>
      <Pressable onPress={onBack} style={({ pressed }) => [s.back, pressed && ui.pressed]}>
        <MaterialCommunityIcons name="arrow-left" size={18} color={T.text} />
        <Text style={s.ghostText}>All trips</Text>
      </Pressable>
      {error !== '' && <Text style={ui.error}>{error}</Text>}
      {trip === null && error === '' && <ActivityIndicator color={T.text} style={s.loading} />}
      {trip !== null && (
        <>
          <View style={s.tripHead}>
            <Avatar name={trip.driver} big />
            <View style={s.flex}>
              <Text style={ui.title}>{trip.driver}</Text>
              <View style={s.chipLine}>
                <Chip icon="calendar" text={when(trip.start)} />
                <Chip icon="map-marker-distance" text={`${trip.distance_km.toFixed(1)} km`} />
                {trip.phone && <Chip icon="cellphone" text={phoneName(trip.phone)} />}
              </View>
            </View>
          </View>
          <View style={width >= WIDE ? s.twoColumns : ui.section}>
            <View style={width >= WIDE ? s.mainColumn : undefined}>
              {trip.scored ? <ScoredTrip score={trip.score} reasons={trip.reasons} /> : (
                <View style={ui.card}>
                  <Text style={ui.cardTitle}>Not scored</Text>
                  <Text style={ui.body}>{sentence(trip.why)}</Text>
                </View>
              )}
            </View>
            <View style={width >= WIDE ? s.sideColumn : undefined}>
              <RouteCard route={trip.route} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function RouteCard({ route }: { route: [number, number][] }) {
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
      <View style={s.tileHead}>
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

const Stat = ({ icon, label, value }: { icon: IconName; label: string; value: string }) => (
  <View style={[ui.card, s.stat]}>
    <View style={s.tileHead}>
      <MaterialCommunityIcons name={icon} size={18} color={T.muted} />
      <Text style={ui.label}>{label}</Text>
    </View>
    <Text style={s.statValue}>{value}</Text>
  </View>
);

const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [s.filter, active && s.filterActive, pressed && ui.pressed]}>
    <Text style={[s.filterText, active && s.filterTextActive]}>{label}</Text>
  </Pressable>
);

function ScoreBadge({ score, withWord }: { score: number; withWord: boolean }) {
  const tier = drivingTier(score);
  const color = T.ring[tier.level][0];
  return (
    <View style={[s.badge, { backgroundColor: `${color}1F` }]}>
      <Text style={[s.badgeNumber, { color }]}>{score.toFixed(0)}</Text>
      {withWord && <Text style={[s.badgeWord, { color }]} numberOfLines={1}>{tier.word}</Text>}
    </View>
  );
}

const AVATAR_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6'];

function Avatar({ name, big }: { name: string; big?: boolean }) {
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

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const phoneName = (phone: NonNullable<Phone>) => `${phone.device} (${phone.platform === 'ios' ? 'iOS' : 'Android'})`;
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.');

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 64 },
  frame: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: 20 },
  flex: { flex: 1 },
  loginPage: { flexGrow: 1, justifyContent: 'center' },
  loginBox: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { color: T.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  adminPill: { backgroundColor: T.text, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  adminPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ghostButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, ...T.cardShadow },
  ghostText: { color: T.text, fontSize: 14, fontWeight: '700' },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  loading: { marginTop: 40 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 140, gap: 4 },
  statValue: { color: T.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: T.card, ...T.cardShadow },
  filterActive: { backgroundColor: T.text },
  filterText: { color: T.text, fontSize: 14, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  table: { padding: 8, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 18 },
  rowDivider: { borderTopColor: T.track, borderTopWidth: 1, borderRadius: 0 },
  rowHover: { backgroundColor: '#F6F7F9' },
  headerRow: { paddingVertical: 8 },
  th: { color: T.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  td: { color: T.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  colTrip: { flex: 1 },
  colNum: { width: 100, textAlign: 'right' },
  colScore: { width: 150, alignItems: 'flex-end' },
  right: { textAlign: 'right' },
  tripCell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driver: { color: T.text, fontSize: 16, fontWeight: '700' },
  empty: { padding: 16 },
  badge: { flexDirection: 'row', alignItems: 'baseline', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeNumber: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  badgeWord: { fontSize: 12, fontWeight: '700' },
  notScored: { backgroundColor: T.track, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  notScoredText: { color: T.muted, fontSize: 13, fontWeight: '700' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarBig: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { fontSize: 14, fontWeight: '800' },
  avatarTextBig: { fontSize: 22 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chipLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  twoColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  mainColumn: { flex: 3 },
  sideColumn: { flex: 2 },
  legendRow: { flexDirection: 'row', gap: 16 },
  dotItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
