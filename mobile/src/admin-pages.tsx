// Dashboard pages beyond trips: drivers, the company's team (owner only) and companies (FairDrive team only).

import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, useWindowDimensions, View } from 'react-native';

import {
  AdminSession as Session, Company, getTeam, inviteMember, listCompanies, listDrivers, removeDriver, removeMember, setCompanyStatus,
} from './admin-api';
import { Button, ConfirmButton, FilterChip, Input, s, WIDE } from './admin-ui';
import { C } from './brand';
import { LoggedOut } from './fairdrive';
import { Avatar } from './trip-parts';

/** Loads data once on mount. A missing or expired login calls onLoggedOut; other errors land in `error`. */
export function useLoad<T>(load: () => Promise<T>, onLoggedOut: () => void) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      setData(await load());
    } catch (e) {
      if (e instanceof LoggedOut) onLoggedOut();
      else setError((e as Error).message);
    }
  }
  useEffect(() => { run(async () => {}); }, []);
  /** reload: fetch again. act: do something (such as remove), then fetch again. */
  return { data, error, reload: () => run(async () => {}), act: run };
}

const day = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Loading({ error, loaded }: { error: string; loaded: boolean }) {
  if (error !== '') return <Text style={s.error}>{error}</Text>;
  return loaded ? null : <ActivityIndicator color={C.ink} style={s.loading} />;
}

function Heading({ title, lead }: { title: string; lead: string }) {
  return (
    <View style={s.flex}>
      <Text style={s.h2}>{title}</Text>
      <Text style={s.muted}>{lead}</Text>
    </View>
  );
}

export function DriversPage({ session, onLoggedOut }: { session: Session; onLoggedOut: () => void }) {
  const { data: drivers, error, act } = useLoad(() => listDrivers(session), onLoggedOut);
  const wide = useWindowDimensions().width >= WIDE;
  const { role, company } = session.account;

  return (
    <View style={s.stack}>
      <Heading title="Drivers" lead={company
        ? `People who chose ${company.name} when they signed up in the FairDrive app.`
        : 'Everyone with a FairDrive account, and the insurance company they chose.'} />
      <Loading error={error} loaded={drivers !== null} />
      {drivers !== null && (
        <View style={s.table}>
          {wide && (
            <View style={[s.tr, s.thRow]}>
              <Text style={[s.th, s.colTrip]}>Driver</Text>
              {!company && <Text style={[s.th, s.colWide]}>Insurance company</Text>}
              <Text style={[s.th, s.colNum]}>Trips</Text>
              {role === 'owner' && <View style={s.colAction} />}
            </View>
          )}
          {drivers.length === 0 && (
            <Text style={[s.muted, s.empty]}>
              {company ? `No drivers yet. They appear here once they sign up in the FairDrive app and choose ${company.name}.` : 'No drivers yet.'}
            </Text>
          )}
          {drivers.map((d, i) => (
            <View key={d.driver_id} style={[s.tr, i > 0 && s.trDivider, !wide && s.wrap]}>
              <View style={[s.colTrip, s.tripCell, s.minWide]}>
                <Avatar name={d.name} />
                <View style={s.flex}>
                  <Text style={s.driver}>{d.name}</Text>
                  <Text style={s.muted}>{d.email}{wide ? '' : ` · ${d.trips} trips`}{wide || company ? '' : ` · ${d.company ?? 'No insurer'}`}</Text>
                </View>
              </View>
              {wide && !company && <Text style={[s.td, s.colWide]}>{d.company ?? 'No insurer'}</Text>}
              {wide && <Text style={[s.td, s.colNum]}>{d.trips}</Text>}
              {role === 'owner' && (
                <View style={wide ? s.colAction : undefined}>
                  <ConfirmButton label="Remove" confirm={`Remove ${d.name}`} onConfirm={() => act(() => removeDriver(session, d.driver_id))} />
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      {role === 'owner' && drivers !== null && drivers.length > 0 && (
        <Text style={s.muted}>Removing a driver hides them and their trips from {company!.name}. Their FairDrive account stays.</Text>
      )}
    </View>
  );
}

export function TeamPage({ session, onLoggedOut }: { session: Session; onLoggedOut: () => void }) {
  const { data: team, error, act } = useLoad(() => getTeam(session), onLoggedOut);
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const wide = useWindowDimensions().width >= WIDE;
  const company = session.account.company!.name;

  function invite() {
    const to = email.trim().toLowerCase();
    if (to === '') return;
    act(async () => {
      const code = await inviteMember(session, to);
      setLink({ email: to, url: Linking.createURL('/admin', { queryParams: { invite: code } }) });
      setCopied(false);
      setEmail('');
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(link!.url);
    setCopied(true);
  }

  return (
    <View style={s.stack}>
      <Heading title="Team" lead={`People at ${company} who can see your drivers' trips. Only you can add or remove them.`} />

      <View style={s.panel}>
        <Text style={s.panelTitle}>Add a team member</Text>
        <View style={s.inviteRow}>
          <View style={[s.flex, s.minWide]}>
            <Input label="Their work email" value={email} onChange={setEmail} placeholder="sam@company.com" kind="email" onSubmit={invite} />
          </View>
          <Button label="Create invite link" small disabled={email.trim() === ''} onPress={invite} />
        </View>
        {link && (
          <View style={s.linkBox}>
            <Text style={s.muted}>Send this link to {link.email}. It works once, for 7 days.</Text>
            <Text style={s.linkText} selectable>{link.url}</Text>
            <View style={s.inlineRow}><Button label={copied ? 'Copied' : 'Copy link'} outline small onPress={copy} /></View>
          </View>
        )}
      </View>

      <Loading error={error} loaded={team !== null} />
      {team !== null && (
        <View style={s.table}>
          {team.members.map((m, i) => (
            <View key={m.email} style={[s.tr, i > 0 && s.trDivider, !wide && s.wrap]}>
              <View style={[s.colTrip, s.tripCell, s.minWide]}>
                <Avatar name={m.name} />
                <View style={s.flex}>
                  <Text style={s.driver}>{m.name}</Text>
                  <Text style={s.muted}>{m.email} · {m.role === 'owner' ? 'Owner' : 'Member'}</Text>
                </View>
              </View>
              <View style={wide ? s.colAction : undefined}>
                {m.role === 'member' && <ConfirmButton label="Remove" confirm={`Remove ${m.name}`} onConfirm={() => act(() => removeMember(session, m.email))} />}
              </View>
            </View>
          ))}
          {team.invites.map((inv) => (
            <View key={inv.email} style={[s.tr, s.trDivider]}>
              <View style={s.colTrip}>
                <Text style={s.driver}>{inv.email}</Text>
                <Text style={s.muted}>Invited. The link works until {day(inv.expires)}.</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const STATUS_LABELS: Record<Company['status'], string> = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' };

export function CompaniesPage({ session, onLoggedOut }: { session: Session; onLoggedOut: () => void }) {
  const { data: companies, error, act } = useLoad(() => listCompanies(session), onLoggedOut);
  const [status, setStatus] = useState<Company['status']>('pending');
  const wide = useWindowDimensions().width >= WIDE;
  const shown = (companies ?? []).filter((c) => c.status === status);
  const decide = (c: Company, action: 'approve' | 'reject') => act(() => setCompanyStatus(session, c.company_id, action));

  return (
    <View style={s.stack}>
      <Heading title="Insurance companies" lead="Approve a company before its team can log in and its customers can choose it in the FairDrive app." />
      <Loading error={error} loaded={companies !== null} />
      {companies !== null && (
        <>
          <View style={s.filterRow}>
            {(['pending', 'approved', 'rejected'] as const).map((st) => (
              <FilterChip key={st} label={`${STATUS_LABELS[st]} (${companies.filter((c) => c.status === st).length})`}
                active={status === st} onPress={() => setStatus(st)} />
            ))}
          </View>
          <View style={s.table}>
            {shown.length === 0 && (
              <Text style={[s.muted, s.empty]}>
                {status === 'pending' ? 'No companies are waiting. New sign-ups appear here.' : `No ${STATUS_LABELS[status].toLowerCase()} companies.`}
              </Text>
            )}
            {shown.map((c, i) => (
              <View key={c.company_id} style={[s.tr, i > 0 && s.trDivider, !wide && s.wrap]}>
                <View style={[s.colTrip, s.minWide]}>
                  <Text style={s.driver}>{c.name}</Text>
                  <Text style={s.muted}>{c.owner.name} · {c.owner.email}</Text>
                  <Text style={s.muted}>Signed up {day(c.created)} · {c.drivers} {c.drivers === 1 ? 'driver' : 'drivers'}</Text>
                </View>
                <View style={s.actions}>
                  {c.status !== 'approved' && <Button label={`Approve ${c.name}`} small onPress={() => decide(c, 'approve')} />}
                  {c.status === 'pending' && <ConfirmButton label="Reject" confirm={`Reject ${c.name}`} onConfirm={() => decide(c, 'reject')} />}
                  {c.status === 'approved' && <ConfirmButton label="Remove access" confirm={`Remove ${c.name}'s access`} onConfirm={() => decide(c, 'reject')} />}
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
