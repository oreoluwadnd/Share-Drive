// The admin side of the FairDrive API: log in, list every trip, open one.

import { Reasons, Score } from './fairdrive';

export type Session = { server: string; token: string; email: string };
export type Phone = { device: string; platform: string } | null;

export type TripRow = {
  trip_id: string; driver: string; start: string; distance_km: number; phone: Phone;
  scored: boolean; why: string | null;
  driving_score: number | null; conditions_score: number | null; old_score: number | null;
};

export type TripDetail = { trip_id: string; driver: string; start: string; distance_km: number; phone: Phone; route: [number, number][] } & (
  | { scored: true; score: Score; reasons: Reasons }
  | { scored: false; why: string }
);

/** Thrown when the session is missing or expired, so the dashboard can go back to the login. */
export class LoggedOut extends Error {}

export async function login(server: string, email: string, password: string): Promise<Session> {
  const response = await fetch(`${server}/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail);
  return { server, token: body.token, email: body.email };
}

export async function listTrips(session: Session): Promise<TripRow[]> {
  return (await get(session, '/admin/trips')).trips;
}

export async function getTrip(session: Session, tripId: string): Promise<TripDetail> {
  return get(session, `/admin/trips/${tripId}`);
}

async function get(session: Session, path: string) {
  const response = await fetch(`${session.server}${path}`, { headers: { Authorization: `Bearer ${session.token}` } });
  const body = await response.json();
  if (response.status === 401) throw new LoggedOut(body.detail);
  if (!response.ok) throw new Error(body.detail);
  return body;
}
