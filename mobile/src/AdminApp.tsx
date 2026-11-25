// The web dashboard: the FairDrive team logs in and sees every trip uploaded to FairDrive.
// Same brand as the landing page (src/brand.ts): warm paper, FairDrive green, flat colours, hairline borders.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { AdminSession as Session, AdminTripDetail as TripDetail, AdminTripRow as TripRow, getTrip, listTrips, login } from './admin-api';
import { C, FONT, text as f, useBrandFonts } from './brand';
import { LoggedOut } from './fairdrive';
import { ScoredTrip } from './score';
import { average, Avatar, NotScoredBadge, phoneName, RouteCard, ScoreBadge, sentence, when } from './trip-parts';

const WIDE = 900;

export default function AdminApp({ onHome }: { onHome: () => void }) {
  const fontsReady = useBrandFonts();
  const [session, setSession] = useState<Session | null>(null);
  const [openTrip, setOpenTrip] = useState<string | null>(null);
  const logOut = () => { setSession(null); setOpenTrip(null); };
  if (!fontsReady) return <View style={s.root} />;

  if (!session) return <Login onLogin={setSession} onHome={onHome} />;
  return (
    <View style={s.root}>
      <ScrollView stickyHeaderIndices={[0]}>
        <TopBar email={session.email} onLogOut={logOut} onHome={onHome} />
        <View style={[s.content, s.page]}>
          {openTrip
            ? <TripPage session={session} tripId={openTrip} onBack={() => setOpenTrip(null)} onLoggedOut={logOut} />
            : <TripsPage session={session} onOpen={setOpenTrip} onLoggedOut={logOut} />}
        </View>
      </ScrollView>
    </View>
  );
}

function Login({ onLogin, onHome }: { onLogin: (session: Session) => void; onHome: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const wide = useWindowDimensions().width >= WIDE;
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
    <ScrollView style={s.root} contentContainerStyle={[s.loginPage, wide && s.row]}>
      <View style={[s.loginPanel, wide && s.loginPanelWide]}>
        <Pressable onPress={onHome}><Wordmark light /></Pressable>
        <View style={s.loginPanelText}>
          <Text style={[s.h1, !wide && s.h1Narrow, s.onGreen]}>The FairDrive dashboard</Text>
          <Text style={[s.lead, s.onGreenMuted]}>Every drive uploaded to FairDrive, with both scores, the reasons behind them and the route.</Text>
        </View>
      </View>

      <View style={[s.loginForm, wide && s.loginFormWide]}>
        <View style={s.form}>
          <Text style={s.h2}>Log in</Text>
          <Input label="Email" value={email} onChange={setEmail} placeholder="you@example.com" email onSubmit={submit} />
          <Input label="Password" value={password} onChange={setPassword} placeholder="Your password" secret onSubmit={submit} />
          {error !== '' && <Text style={s.error}>{error}</Text>}
          <Button label={busy ? 'Logging in…' : 'Log in'} disabled={!ready} onPress={submit} />
          <Text style={s.muted}>No account? Ask the FairDrive team to add you.</Text>
          <TextLink label="Back to the FairDrive site" onPress={onHome} />
        </View>
      </View>
    </ScrollView>
  );
}

function TopBar({ email, onLogOut, onHome }: { email: string; onLogOut: () => void; onHome: () => void }) {
  const wide = useWindowDimensions().width >= WIDE;
  return (
    <View style={s.topBar}>
      <View style={[s.content, s.topRow]}>
        <Pressable onPress={onHome} style={s.brandRow}>
          <Wordmark />
          <Text style={s.section}>Dashboard</Text>
        </Pressable>
        <View style={s.topRight}>
          {wide && <Text style={s.muted}>{email}</Text>}
          <Button label="Log out" outline small onPress={onLogOut} />
        </View>
      </View>
    </View>
  );
}

function TripsPage({ session, onOpen, onLoggedOut }: { session: Session; onOpen: (id: string) => void; onLoggedOut: () => void }) {
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [error, setError] = useState('');
  const [driver, setDriver] = useState<string | null>(null);
  const wide = useWindowDimensions().width >= WIDE;

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
    <View style={s.stack}>
      <View style={s.headRow}>
        <View style={s.flex}>
          <Text style={s.h2}>All trips</Text>
          <Text style={s.muted}>Every drive uploaded to FairDrive, newest first.</Text>
        </View>
        <Button label="Refresh trips" outline small onPress={load} />
      </View>

      {error !== '' && <Text style={s.error}>{error}</Text>}
      {trips === null && error === '' && <ActivityIndicator color={C.ink} style={s.loading} />}

      {trips !== null && (
        <>
          <View style={s.statRow}>
            <Stat label="Trips" value={String(shown.length)} />
            <Stat label="Drivers" value={String(new Set(shown.map((t) => t.driver)).size)} />
            <Stat label="Km driven" value={shown.reduce((sum, t) => sum + t.distance_km, 0).toFixed(0)} />
            <Stat label="Average driving score" value={scored.length ? average(scored.map((t) => t.driving_score as number)).toFixed(0) : '–'} />
          </View>

          <View style={s.filterRow}>
            <FilterChip label="All drivers" active={driver === null} onPress={() => setDriver(null)} />
            {drivers.map((d) => <FilterChip key={d} label={d} active={driver === d} onPress={() => setDriver(d)} />)}
          </View>

          <View style={s.table}>
            {wide && (
              <View style={[s.tr, s.thRow]}>
                <Text style={[s.th, s.colTrip]}>Driver and trip</Text>
                <Text style={[s.th, s.colNum]}>Km</Text>
                <Text style={[s.th, s.colScore]}>Driving score</Text>
                <Text style={[s.th, s.colNum]}>Conditions</Text>
                <Text style={[s.th, s.colNum]}>Old score</Text>
              </View>
            )}
            {shown.length === 0 && <Text style={[s.muted, s.empty]}>No trips yet. They appear here once drivers send them.</Text>}
            {shown.map((trip, i) => <TripLine key={trip.trip_id} trip={trip} wide={wide} first={i === 0} onPress={() => onOpen(trip.trip_id)} />)}
          </View>
        </>
      )}
    </View>
  );
}

function TripLine({ trip, wide, first, onPress }: { trip: TripRow; wide: boolean; first: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.tr, !first && s.trDivider, hovered && s.trHover]}>
      <View style={[s.colTrip, s.tripCell]}>
        <Avatar name={trip.driver_name} />
        <View style={s.flex}>
          <Text style={s.driver}>{trip.driver_name}</Text>
          <Text style={s.muted}>{when(trip.start)}{trip.phone ? ` · ${phoneName(trip.phone)}` : ''}{wide ? '' : ` · ${trip.distance_km.toFixed(1)} km`}</Text>
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
  const wide = useWindowDimensions().width >= WIDE;

  useEffect(() => {
    getTrip(session, tripId).then(setTrip).catch((e) => (e instanceof LoggedOut ? onLoggedOut() : setError((e as Error).message)));
  }, [tripId]);

  return (
    <View style={s.stack}>
      <Pressable onPress={onBack} style={s.back}>
        <MaterialCommunityIcons name="arrow-left" size={18} color={C.green} />
        <TextLink label="All trips" onPress={onBack} />
      </Pressable>
      {error !== '' && <Text style={s.error}>{error}</Text>}
      {trip === null && error === '' && <ActivityIndicator color={C.ink} style={s.loading} />}
      {trip !== null && (
        <>
          <View style={s.tripHead}>
            <Avatar name={trip.driver_name} big />
            <View style={s.flex}>
              <Text style={s.h2}>{trip.driver_name}</Text>
              <Text style={s.muted}>
                {when(trip.start)} · {trip.distance_km.toFixed(1)} km{trip.phone ? ` · ${phoneName(trip.phone)}` : ''}
              </Text>
            </View>
          </View>
          <View style={wide ? s.twoColumns : s.stack}>
            <View style={wide ? s.mainColumn : undefined}>
              {trip.scored ? <ScoredTrip score={trip.score} reasons={trip.reasons} /> : (
                <View style={s.panel}>
                  <Text style={s.panelTitle}>Not scored</Text>
                  <Text style={s.muted}>{sentence(trip.why)}</Text>
                </View>
              )}
            </View>
            <View style={wide ? s.sideColumn : undefined}>
              <RouteCard route={trip.route} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// Pieces

const Wordmark = ({ light }: { light?: boolean }) => (
  <View style={s.brandRow}>
    <View style={[s.mark, light && s.markLight]}>
      <MaterialCommunityIcons name="road-variant" size={16} color={light ? C.green : C.white} />
    </View>
    <Text style={[s.wordmark, light && s.onGreen]}>FairDrive</Text>
  </View>
);

function Input(p: { label: string; value: string; onChange: (t: string) => void; placeholder: string; email?: boolean; secret?: boolean; onSubmit: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.inputGroup}>
      <Text style={s.inputLabel}>{p.label}</Text>
      <TextInput
        style={[s.input, focused && s.inputFocused]} value={p.value} onChangeText={p.onChange} placeholder={p.placeholder} placeholderTextColor="#A39B8D"
        autoCapitalize="none" autoCorrect={false} keyboardType={p.email ? 'email-address' : 'default'} secureTextEntry={p.secret}
        autoComplete={p.email ? 'email' : 'current-password'} onSubmitEditing={p.onSubmit} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      />
    </View>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={s.stat}>
    <Text style={s.muted}>{label}</Text>
    <Text style={s.statValue}>{value}</Text>
  </View>
);

const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.filter, hovered && s.filterHover, active && s.filterActive]}>
    <Text style={[s.filterText, active && s.filterTextActive]}>{label}</Text>
  </Pressable>
);

function Button({ label, outline, small, disabled, onPress }: { label: string; outline?: boolean; small?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
      s.button, outline && s.buttonOutline, small && s.buttonSmall, hovered && (outline ? s.buttonOutlineHover : s.buttonHover),
      pressed && s.buttonPressed, disabled && s.buttonDisabled,
    ]}>
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <Text style={[s.buttonText, outline && !hovered && s.buttonTextOutline, small && s.buttonTextSmall]}>{label}</Text>
      )}
    </Pressable>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => <Text style={[s.link, hovered && s.linkHover]}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 1160, alignSelf: 'center', paddingHorizontal: 24 },
  page: { paddingTop: 40, paddingBottom: 80 },
  stack: { gap: 24 },
  onGreen: { color: C.white },
  onGreenMuted: { color: C.onGreenMuted },

  loginPage: { flexGrow: 1, minHeight: '100%' } as object,
  loginPanel: { backgroundColor: C.green, padding: 32, gap: 48 },
  loginPanelWide: { flex: 1, padding: 56, justifyContent: 'space-between' },
  loginPanelText: { gap: 16, maxWidth: 520 },
  loginForm: { padding: 32, justifyContent: 'center' },
  loginFormWide: { flex: 1, padding: 56 },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 18 },

  topBar: { height: 68, justifyContent: 'center', backgroundColor: C.paper, borderBottomWidth: 1, borderBottomColor: C.line },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  markLight: { backgroundColor: C.white },
  wordmark: f(FONT.head, { fontSize: 22, letterSpacing: -0.4 }),
  section: f(FONT.bodyMedium, { fontSize: 15, color: C.muted, paddingLeft: 12, marginLeft: 2, borderLeftWidth: 1, borderLeftColor: C.line }),

  h1: f(FONT.head, { fontSize: 56, lineHeight: 60, letterSpacing: -1.6 }),
  h1Narrow: { fontSize: 38, lineHeight: 42, letterSpacing: -1 },
  h2: f(FONT.head, { fontSize: 36, lineHeight: 42, letterSpacing: -0.8 }),
  lead: f(FONT.body, { fontSize: 19, lineHeight: 28 }),
  muted: f(FONT.body, { fontSize: 15, lineHeight: 22, color: C.muted }),
  error: f(FONT.bodyMedium, { fontSize: 15, color: C.red }),

  inputGroup: { gap: 6 },
  inputLabel: f(FONT.bodyMedium, { fontSize: 14 }),
  input: { fontFamily: FONT.body, fontSize: 16, color: C.ink, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  inputFocused: { borderColor: C.green },

  headRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 },
  loading: { marginTop: 40 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 160, gap: 4, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 20 },
  statValue: f(FONT.head, { fontSize: 40, lineHeight: 46, letterSpacing: -1 }),

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  filterHover: { borderColor: C.ink },
  filterActive: { backgroundColor: C.ink, borderColor: C.ink },
  filterText: f(FONT.bodyMedium, { fontSize: 14 }),
  filterTextActive: { color: C.white },

  table: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  trDivider: { borderTopWidth: 1, borderTopColor: C.line },
  trHover: { backgroundColor: C.paper },
  thRow: { backgroundColor: C.paper, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  th: f(FONT.bodyMedium, { fontSize: 13, color: C.muted }),
  td: f(FONT.bodyMedium, { fontSize: 15, fontVariant: ['tabular-nums'] }),
  colTrip: { flex: 1 },
  colNum: { width: 100, textAlign: 'right' },
  colScore: { width: 150, alignItems: 'flex-end', textAlign: 'right' } as object,
  tripCell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driver: f(FONT.bodyBold, { fontSize: 16 }),
  empty: { padding: 20 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  twoColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  mainColumn: { flex: 3 },
  sideColumn: { flex: 2 },
  panel: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 24, gap: 8 },
  panelTitle: f(FONT.headSemi, { fontSize: 22 }),

  button: { backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 15, alignItems: 'center' },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.ink },
  buttonSmall: { paddingHorizontal: 18, paddingVertical: 9 },
  buttonHover: { backgroundColor: C.greenHover, transform: [{ translateY: -1 }] },
  buttonOutlineHover: { backgroundColor: C.ink },
  buttonPressed: { transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.4 },
  buttonText: f(FONT.bodyBold, { color: C.white, fontSize: 17 }),
  buttonTextOutline: { color: C.ink },
  buttonTextSmall: { fontSize: 14 },
  link: f(FONT.bodyBold, { fontSize: 15, color: C.green }),
  linkHover: { textDecorationLine: 'underline' },
});
