// The web dashboard. Insurance companies sign up here and wait for the FairDrive team to approve them; then their owner
// and team see their own drivers' trips. The FairDrive team (super admins) sees everything and approves companies.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import {
  acceptInvite, Account, AdminSession as Session, AdminTripDetail as TripDetail, AdminTripRow as TripRow,
  getInvite, getTrip, listTrips, login, signUpCompany,
} from './admin-api';
import { CompaniesPage, DriversPage, TeamPage, useLoad } from './admin-pages';
import { Button, Input, s, Stat, TextLink, WIDE, Wordmark } from './admin-ui';
import { C, useBrandFonts } from './brand';
import { LoggedOut } from './fairdrive';
import { storage } from './storage';
import { ScoredTrip } from './score';
import { average, Avatar, NotScoredBadge, phoneName, RouteCard, ScoreBadge, sentence, when } from './trip-parts';

type Tab = 'trips' | 'drivers' | 'team' | 'companies';
const TAB_LABELS: Record<Tab, string> = { trips: 'Trips', drivers: 'Drivers', team: 'Team', companies: 'Companies' };

/** inviteCode: from a team invite link (/admin?invite=CODE). onInviteUsed clears it once the person has joined. */
export default function AdminApp({ onHome, inviteCode, onInviteUsed }: { onHome: () => void; inviteCode?: string; onInviteUsed: () => void }) {
  const fontsReady = useBrandFonts();
  // undefined until the saved login (if any) has been read.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('trips');
  const [openTrip, setOpenTrip] = useState<string | null>(null);

  useEffect(() => { storage.get('admin').then((saved) => setSession(saved ? JSON.parse(saved) : null)); }, []);
  const logIn = (next: Session) => { storage.set('admin', JSON.stringify(next)); setSession(next); };
  const logOut = () => { storage.remove('admin'); setSession(null); setOpenTrip(null); setTab('trips'); };
  if (!fontsReady || session === undefined) return <View style={s.root} />;

  if (!session) {
    if (inviteCode) return <Join code={inviteCode} onJoined={(next) => { onInviteUsed(); logIn(next); }} onHome={onHome} />;
    return <LoggedOutPages onLogin={logIn} onHome={onHome} />;
  }
  const { account } = session;
  const tabs: Tab[] = ['trips', 'drivers', ...(account.role === 'owner' ? ['team' as const] : []), ...(account.role === 'super' ? ['companies' as const] : [])];
  const show = (next: Tab) => { setTab(next); setOpenTrip(null); };

  return (
    <View style={s.root}>
      <ScrollView stickyHeaderIndices={[0]}>
        <TopBar account={account} tabs={tabs} tab={tab} onTab={show} onLogOut={logOut} onHome={onHome} />
        <View style={[s.content, s.page]}>
          {tab === 'trips' && (openTrip
            ? <TripPage session={session} tripId={openTrip} onBack={() => setOpenTrip(null)} onLoggedOut={logOut} />
            : <TripsPage session={session} onOpen={setOpenTrip} onLoggedOut={logOut} />)}
          {tab === 'drivers' && <DriversPage session={session} onLoggedOut={logOut} />}
          {tab === 'team' && <TeamPage session={session} onLoggedOut={logOut} />}
          {tab === 'companies' && <CompaniesPage session={session} onLoggedOut={logOut} />}
        </View>
      </ScrollView>
    </View>
  );
}

// Before logging in

/** The green panel on the left (or on top, on a phone) and a form beside it. */
function AuthFrame({ title, lead, onHome, children }: { title: string; lead: string; onHome: () => void; children: ReactNode }) {
  const wide = useWindowDimensions().width >= WIDE;
  return (
    <ScrollView style={s.root} contentContainerStyle={[s.loginPage, wide && s.row]}>
      <View style={[s.loginPanel, wide && s.loginPanelWide]}>
        <Pressable onPress={onHome}><Wordmark light /></Pressable>
        <View style={s.loginPanelText}>
          <Text style={[s.h1, !wide && s.h1Narrow, s.onGreen]}>{title}</Text>
          <Text style={[s.lead, s.onGreenMuted]}>{lead}</Text>
        </View>
      </View>
      <View style={[s.loginForm, wide && s.loginFormWide]}>
        <View style={s.form}>{children}</View>
      </View>
    </ScrollView>
  );
}

const DASHBOARD_LEAD = "Your drivers' scores, the reasons behind them and the route of every drive.";
const SIGN_UP_TITLE = 'Bring FairDrive to your customers';
const SIGN_UP_LEAD = 'Sign up your insurance company. Once the FairDrive team approves it, your customers can choose you in the FairDrive app and you see their scores here.';

function LoggedOutPages({ onLogin, onHome }: { onLogin: (session: Session) => void; onHome: () => void }) {
  const [page, setPage] = useState<'login' | 'signup' | { company: string; email: string }>('login');
  if (page === 'login') return <Login onLogin={onLogin} onSignUp={() => setPage('signup')} onHome={onHome} />;
  if (page === 'signup') return <CompanySignUp onDone={setPage} onLogin={() => setPage('login')} onHome={onHome} />;
  return (
    <AuthFrame title={SIGN_UP_TITLE} lead={SIGN_UP_LEAD} onHome={onHome}>
      <Text style={s.h2}>Thanks, {page.company} is signed up</Text>
      <Text style={s.body}>
        The FairDrive team will review it. Once it's approved, log in with {page.email}, and your customers can choose {page.company} in the FairDrive app.
      </Text>
      <Button label="Back to log in" onPress={() => setPage('login')} />
    </AuthFrame>
  );
}

function Login({ onLogin, onSignUp, onHome }: { onLogin: (session: Session) => void; onSignUp: () => void; onHome: () => void }) {
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
    <AuthFrame title="The FairDrive dashboard" lead={DASHBOARD_LEAD} onHome={onHome}>
      <Text style={s.h2}>Log in</Text>
      <Input label="Email" value={email} onChange={setEmail} placeholder="you@company.com" kind="email" onSubmit={submit} />
      <Input label="Password" value={password} onChange={setPassword} placeholder="Your password" kind="password" onSubmit={submit} />
      {error !== '' && <Text style={s.error}>{error}</Text>}
      <Button label={busy ? 'Logging in…' : 'Log in'} disabled={!ready} onPress={submit} />
      <View style={s.inlineRow}>
        <Text style={s.muted}>New insurance company?</Text>
        <TextLink label="Sign up your company" onPress={onSignUp} />
      </View>
      <TextLink label="Back to the FairDrive site" onPress={onHome} />
    </AuthFrame>
  );
}

function CompanySignUp({ onDone, onLogin, onHome }: {
  onDone: (done: { company: string; email: string }) => void; onLogin: () => void; onHome: () => void;
}) {
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = [company, name, email].every((v) => v.trim() !== '') && password !== '' && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      const { company: made } = await signUpCompany(company.trim(), name.trim(), email.trim(), password);
      onDone({ company: made.name, email: email.trim().toLowerCase() });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthFrame title={SIGN_UP_TITLE} lead={SIGN_UP_LEAD} onHome={onHome}>
      <Text style={s.h2}>Sign up your company</Text>
      <Input label="Company name" value={company} onChange={setCompany} placeholder="Acme Insurance" kind="organization" onSubmit={submit} />
      <Input label="Your name" value={name} onChange={setName} placeholder="Ana Silva" kind="name" onSubmit={submit} />
      <Input label="Work email" value={email} onChange={setEmail} placeholder="you@company.com" kind="email" onSubmit={submit} />
      <Input label="Password" value={password} onChange={setPassword} placeholder="At least 8 characters" kind="new-password" onSubmit={submit} />
      {error !== '' && <Text style={s.error}>{error}</Text>}
      <Button label={busy ? 'Signing up…' : 'Sign up company'} disabled={!ready} onPress={submit} />
      <View style={s.inlineRow}>
        <Text style={s.muted}>Already approved?</Text>
        <TextLink label="Log in" onPress={onLogin} />
      </View>
    </AuthFrame>
  );
}

function Join({ code, onJoined, onHome }: { code: string; onJoined: (session: Session) => void; onHome: () => void }) {
  const [invite, setInvite] = useState<{ email: string; company: string } | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = invite !== null && name.trim() !== '' && password !== '' && !busy;

  useEffect(() => { getInvite(code).then(setInvite).catch((e) => setError((e as Error).message)); }, [code]);

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      onJoined(await acceptInvite(code, name.trim(), password));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="The FairDrive dashboard" lead={DASHBOARD_LEAD} onHome={onHome}>
      {invite === null && error === '' && <ActivityIndicator color={C.ink} />}
      {invite !== null && (
        <>
          <Text style={s.h2}>Join {invite.company}</Text>
          <Text style={s.muted}>You were invited as {invite.email}. Choose a password to finish.</Text>
          <Input label="Your name" value={name} onChange={setName} placeholder="Ana Silva" kind="name" onSubmit={submit} />
          <Input label="Password" value={password} onChange={setPassword} placeholder="At least 8 characters" kind="new-password" onSubmit={submit} />
        </>
      )}
      {error !== '' && <Text style={s.error}>{error}</Text>}
      {invite !== null && <Button label={busy ? 'Joining…' : 'Join team'} disabled={!ready} onPress={submit} />}
      <TextLink label="Back to the FairDrive site" onPress={onHome} />
    </AuthFrame>
  );
}

// Logged in

function TopBar({ account, tabs, tab, onTab, onLogOut, onHome }: {
  account: Account; tabs: Tab[]; tab: Tab; onTab: (tab: Tab) => void; onLogOut: () => void; onHome: () => void;
}) {
  const wide = useWindowDimensions().width >= WIDE;
  return (
    <View style={s.topBar}>
      <View style={[s.content, s.topRow]}>
        <Pressable onPress={onHome} style={s.brandRow}>
          <Wordmark />
          {wide && <Text style={s.section}>{account.company?.name ?? 'FairDrive team'}</Text>}
        </Pressable>
        <View style={s.topRight}>
          {wide && <Text style={s.muted}>{account.email}</Text>}
          <Button label="Log out" outline small onPress={onLogOut} />
        </View>
      </View>
      <View style={[s.content, s.tabRow]}>
        {tabs.map((t) => (
          <Pressable key={t} onPress={() => onTab(t)} style={[s.tab, t === tab && s.tabActive]}>
            {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
              <Text style={[s.tabText, (t === tab || hovered) && s.tabTextActive]}>{TAB_LABELS[t]}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TripsPage({ session, onOpen, onLoggedOut }: { session: Session; onOpen: (id: string) => void; onLoggedOut: () => void }) {
  const { data: trips, error, reload } = useLoad(() => listTrips(session), onLoggedOut);
  const [search, setSearch] = useState('');
  const wide = useWindowDimensions().width >= WIDE;
  const company = session.account.company?.name;

  const find = search.trim().toLowerCase();
  const shown = (trips ?? []).filter((t) => t.driver_name.toLowerCase().includes(find));
  const scored = shown.filter((t) => t.scored);

  return (
    <View style={s.stack}>
      <View style={s.headRow}>
        <View style={s.flex}>
          <Text style={s.h2}>Trips</Text>
          <Text style={s.muted}>{company ? `Drives from ${company}'s drivers, newest first.` : 'Every drive uploaded to FairDrive, newest first.'}</Text>
        </View>
        <Button label="Refresh trips" outline small onPress={reload} />
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

          <View style={s.search}>
            <Input label="Find a driver" value={search} onChange={setSearch} placeholder="Type part of a name" kind="search" onSubmit={() => {}} />
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
            {shown.length === 0 && (
              <Text style={[s.muted, s.empty]}>
                {find ? `No driver's name contains "${search.trim()}".` : company
                  ? `No trips yet. They appear here once your customers sign up in the FairDrive app, choose ${company} and send a drive.`
                  : 'No trips yet. They appear here once drivers send them.'}
              </Text>
            )}
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
