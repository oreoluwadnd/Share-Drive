// The dashboard side of the FairDrive API. A super admin (the FairDrive team) sees everything and approves companies;
// an insurance company's owner and members see only that company's drivers. Only the owner runs the team.

import { request, TripDetail, TripRow } from './fairdrive';

export type Role = 'super' | 'owner' | 'member';
export type Account = { email: string; name?: string; role: Role; company: { company_id: string; name: string } | null };
export type AdminSession = { token: string; account: Account };
export type AdminTripRow = TripRow & { driver_name: string };
export type AdminTripDetail = TripDetail & { driver_name: string };
export type DriverRow = { driver_id: string; name: string; email: string; trips: number; company: string | null };
export type TeamMember = { email: string; name: string; role: Role };
export type Company = {
  company_id: string; name: string; status: 'pending' | 'approved' | 'rejected'; created: number; drivers: number;
  owner: { name: string; email: string };
};

export const login = (email: string, password: string) =>
  request<AdminSession>('/admin/login', { method: 'POST', body: { email, password } });

export const signUpCompany = (company: string, name: string, email: string, password: string) =>
  request<{ company: Company }>('/companies/signup', { method: 'POST', body: { company, name, email, password } });

export const getInvite = (code: string) => request<{ email: string; company: string }>(`/invites/${code}`);

export const acceptInvite = (code: string, name: string, password: string) =>
  request<AdminSession>(`/invites/${code}/accept`, { method: 'POST', body: { name, password } });

export const listTrips = async (session: AdminSession) =>
  (await request<{ trips: AdminTripRow[] }>('/admin/trips', { token: session.token })).trips;

export const getTrip = (session: AdminSession, tripId: string) =>
  request<AdminTripDetail>(`/admin/trips/${tripId}`, { token: session.token });

export const listDrivers = async (session: AdminSession) =>
  (await request<{ drivers: DriverRow[] }>('/admin/drivers', { token: session.token })).drivers;

export const removeDriver = (session: AdminSession, driverId: string) =>
  request<void>(`/admin/drivers/${driverId}`, { method: 'DELETE', token: session.token });

export const getTeam = (session: AdminSession) =>
  request<{ members: TeamMember[]; invites: { email: string; expires: number }[] }>('/admin/team', { token: session.token });

export const inviteMember = async (session: AdminSession, email: string) =>
  (await request<{ code: string }>('/admin/team/invites', { method: 'POST', token: session.token, body: { email } })).code;

export const removeMember = (session: AdminSession, email: string) =>
  request<void>(`/admin/team/${encodeURIComponent(email)}`, { method: 'DELETE', token: session.token });

export const listCompanies = async (session: AdminSession) =>
  (await request<{ companies: Company[] }>('/admin/companies', { token: session.token })).companies;

export const setCompanyStatus = (session: AdminSession, companyId: string, action: 'approve' | 'reject') =>
  request<void>(`/admin/companies/${companyId}/${action}`, { method: 'POST', token: session.token });
