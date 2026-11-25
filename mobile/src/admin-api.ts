// The admin side of the FairDrive API: log in, list every trip, open one.

import { request, TripDetail, TripRow } from './fairdrive';

export type AdminSession = { token: string; email: string };
export type AdminTripRow = TripRow & { driver_name: string };
export type AdminTripDetail = TripDetail & { driver_name: string };

export async function login(email: string, password: string): Promise<AdminSession> {
  const body = await request<{ token: string; email: string }>('/admin/login', { method: 'POST', body: { email, password } });
  return { token: body.token, email: body.email };
}

export const listTrips = async (session: AdminSession) =>
  (await request<{ trips: AdminTripRow[] }>('/admin/trips', { token: session.token })).trips;

export const getTrip = (session: AdminSession, tripId: string) =>
  request<AdminTripDetail>(`/admin/trips/${tripId}`, { token: session.token });
