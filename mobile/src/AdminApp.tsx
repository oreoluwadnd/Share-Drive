// The web dashboard: admins log in and see every trip uploaded to FairDrive.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AdminSession as Session, AdminTripDetail as TripDetail, AdminTripRow as TripRow, getTrip, listTrips, login } from './admin-api';
import { LoggedOut } from './fairdrive';
import { PHOTOS } from './photos';
import { ScoredTrip } from './score';
import { average, Avatar, NotScoredBadge, phoneName, RouteCard, ScoreBadge, sentence, when } from './trip-parts';
import { T } from './theme';
import { Banner, Chip, Field, IconName, PrimaryButton, ui } from './ui';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = email.trim() !== '' && password !== '' && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      onLogin(await login(email.trim(), password));
    } catch (e) {
      setError((e as Error).message);
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
        <Banner source={PHOTOS.road} label="A small car driving down a country road" height={170} />
        <View style={ui.card}>
          <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" onSubmit={submit} />
          <View style={ui.cardDivider} />
          <Field label="Password" value={password} onChange={setPassword} placeholder="Your password" secret onSubmit={submit} />
        </View>
        {error !== '' && <Text style={ui.error}>{error}</Text>}
        <PrimaryButton label={busy ? 'Logging in…' : 'Log in'} disabled={!ready} onPress={submit} />
        <Text style={[ui.muted, ui.centerText]}>No account? Ask the FairDrive team to add you as an admin.</Text>
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

  const drivers = useMemo(() => [...new Set((trips ?? []).map((t) => t.driver_name))].sort(), [trips]);
  const shown = (trips ?? []).filter((t) => driver === null || t.driver_name === driver);
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
            <Stat icon="gauge" label="Average driving score" value={scored.length ? average(scored.map((t) => t.driving_score as number)).toFixed(0) : '–'} />
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
        <Avatar name={trip.driver_name} />
        <View style={s.flex}>
          <Text style={s.driver}>{trip.driver_name}</Text>
          <Text style={ui.muted}>{when(trip.start)}{trip.phone ? ` · ${phoneName(trip.phone)}` : ''}{wide ? '' : ` · ${trip.distance_km.toFixed(1)} km`}</Text>
        </View>
      </View>
      {wide && <Text style={[s.td, s.colNum]}>{trip.distance_km.toFixed(1)}</Text>}
      <View style={wide ? s.colScore : undefined}>
        {trip.scored ? <ScoreBadge score={trip.driving_score} withWord={wide} /> : <NotScoredBadge />}
      </View>
      {wide && <Text style={[s.td, s.colNum]}>{trip.scored ? trip.conditions_score.toFixed(0) : '–'}</Text>}
      {wide && <Text style={[s.td, s.colNum]}>{trip.scored ? trip.old_score.toFixed(0) : '–'}</Text>}
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
            <Avatar name={trip.driver_name} big />
            <View style={s.flex}>
              <Text style={ui.title}>{trip.driver_name}</Text>
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
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chipLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  twoColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  mainColumn: { flex: 3 },
  sideColumn: { flex: 2 },
});
