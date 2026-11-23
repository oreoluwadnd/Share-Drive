// Talks to the FairDrive API (`uv run fairdrive api` on a laptop on the same Wi-Fi). Shared by the phone app and the web dashboard.

import { File, UploadTask, UploadType } from 'expo-file-system';

export type Moment = { kind: string; label: string; count: number; normal: number };
export type Score = { driving_score: number; conditions_score: number; old_score: number; km: number; moments: Moment[] };
export type Reasons = { driving_reasons: string[]; conditions_reasons: string[] };
export type Phone = { device: string; platform: string } | null;
export type Driver = { email: string; name: string; driver_id: string };
export type Session = { server: string; token: string; driver: Driver };

export type TripRow = {
  trip_id: string; driver: string; start: string; distance_km: number; phone: Phone;
} & (
  | { scored: true; why: null; driving_score: number; conditions_score: number; old_score: number; moments: Moment[] }
  | { scored: false; why: string; driving_score: null; conditions_score: null; old_score: null; moments: null }
);

export type TripDetail = { trip_id: string; driver: string; start: string; distance_km: number; phone: Phone; route: [number, number][] } & (
  | { scored: true; score: Score; reasons: Reasons }
  | { scored: false; why: string }
);

/** The trips one upload became, each with its score or the reason it has none. */
export type TripResult = { tripId: string; distanceKm: number } & (
  | { kind: 'scored'; score: Score; reasons: Reasons }
  | { kind: 'not scored'; why: string }
);

/** Thrown when the sign-in is missing or expired, so the app can go back to signing in. */
export class LoggedOut extends Error {}

export function serverUrl(typed: string): string {
  const url = typed.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(url) ? url : `http://${url}`;
}

/** A JSON request. `token` is sent as a bearer token; a 401 throws LoggedOut, other errors the server's message. */
export async function request<T>(server: string, path: string, init: { method?: string; token?: string; body?: object } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${server}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error(`Can't reach the FairDrive server at ${server}. Check the address and that the phone is on the same Wi-Fi.`);
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (response.status === 401 && init.token) throw new LoggedOut(body.detail);
  if (!response.ok) throw new Error(body.detail);
  return body;
}

export const signUp = (server: string, name: string, email: string, password: string) =>
  request<{ token: string; driver: Driver }>(server, '/auth/signup', { method: 'POST', body: { name, email, password } });

export const signIn = (server: string, email: string, password: string) =>
  request<{ token: string; driver: Driver }>(server, '/auth/login', { method: 'POST', body: { email, password } });

export const signOut = (session: Session) => request<void>(session.server, '/auth/logout', { method: 'POST', token: session.token });

export const deleteAccount = (session: Session) => request<void>(session.server, '/me', { method: 'DELETE', token: session.token });

export const myTrips = async (session: Session) =>
  (await request<{ trips: TripRow[] }>(session.server, '/me/trips', { token: session.token })).trips;

export const myTrip = (session: Session, tripId: string) => request<TripDetail>(session.server, `/me/trips/${tripId}`, { token: session.token });

/** Uploads the recording as the signed-in driver, then fetches each trip it became. */
export async function sendTrip(session: Session, recording: File): Promise<TripResult[]> {
  const upload = new UploadTask(recording, `${session.server}/trips`, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'application/json',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const response = await upload.uploadAsync();
  if (response.status === 401) throw new LoggedOut(detail(response.body));
  if (response.status !== 201) throw new Error(detail(response.body));

  const trips: { trip_id: string; distance_km: number }[] = JSON.parse(response.body).trips;
  return Promise.all(trips.map(async ({ trip_id, distance_km }) => {
    const trip = await myTrip(session, trip_id);
    const base = { tripId: trip_id, distanceKm: distance_km };
    return trip.scored ? { ...base, kind: 'scored' as const, score: trip.score, reasons: trip.reasons } : { ...base, kind: 'not scored' as const, why: trip.why };
  }));
}

function detail(body: string): string {
  try {
    return JSON.parse(body).detail;
  } catch {
    return body || 'No answer from the FairDrive server.';
  }
}
