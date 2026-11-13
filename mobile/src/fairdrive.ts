// Talks to the FairDrive API (`uv run fairdrive api` on a laptop on the same Wi-Fi).

import { File, UploadTask, UploadType } from 'expo-file-system';

export type Score = { driving_score: number; conditions_score: number; old_score: number; km: number };
export type Reasons = { driving_reasons: string[]; conditions_reasons: string[] };
export type TripResult = { tripId: string; distanceKm: number } & (
  | { kind: 'scored'; score: Score; reasons: Reasons }
  | { kind: 'not scored'; why: string }
);

export function serverUrl(typed: string): string {
  const url = typed.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(url) ? url : `http://${url}`;
}

/** Uploads the recording, then fetches the scores and reasons of every trip in it. */
export async function sendTrip(server: string, driver: string, recording: File): Promise<TripResult[]> {
  const upload = new UploadTask(recording, `${server}/trips`, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'application/json',
    parameters: { driver },
  });
  const response = await upload.uploadAsync();
  if (response.status !== 201) throw new Error(detail(response.body));

  const trips: { trip_id: string; distance_km: number; flag: string | null }[] = JSON.parse(response.body).trips;
  return Promise.all(trips.map(async ({ trip_id, distance_km, flag }) => {
    const base = { tripId: trip_id, distanceKm: distance_km };
    if (flag) return { ...base, kind: 'not scored' as const, why: flag };
    const score = await fetch(`${server}/trips/${trip_id}/score`);
    if (!score.ok) return { ...base, kind: 'not scored' as const, why: detail(await score.text()) };
    const reasons = await fetch(`${server}/trips/${trip_id}/explain`);
    return { ...base, kind: 'scored' as const, score: await score.json(), reasons: await reasons.json() };
  }));
}

function detail(body: string): string {
  try {
    return JSON.parse(body).detail;
  } catch {
    return body || 'No answer from the FairDrive server.';
  }
}
