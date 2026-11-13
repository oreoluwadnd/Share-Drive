// Sensor Logger's JSON export format, so FairDrive reads the app's recordings unchanged:
// a list of records, each tagged with its sensor (Accelerometer = motion without gravity).

export type Reading = [ms: number, x: number, y: number, z: number];
export type Fix = { ms: number; lat: number; lon: number; speed: number; bearing: number; accuracy: number };
export type Drive = { motion: Reading[]; gravity: Reading[]; fixes: Fix[]; startMs: number; device: string; platform: string };

export function sensorLoggerJson(drive: Drive): string {
  const { startMs } = drive;
  const reading = (sensor: string) => ([ms, x, y, z]: Reading) =>
    JSON.stringify({ sensor, time: nanos(ms), seconds_elapsed: elapsed(ms, startMs), z, y, x });
  const records = [
    JSON.stringify({ sensor: 'Metadata', 'device name': drive.device, platform: drive.platform, app: 'FairDrive' }),
    ...drive.motion.map(reading('Accelerometer')),
    ...drive.gravity.map(reading('Gravity')),
    ...drive.fixes.map((f) => JSON.stringify({
      sensor: 'Location', time: nanos(f.ms), seconds_elapsed: elapsed(f.ms, startMs),
      latitude: f.lat, longitude: f.lon, speed: f.speed, bearing: f.bearing, horizontalAccuracy: f.accuracy,
    })),
  ];
  return `[${records.join(',')}]`;
}

// Sensor Logger writes time in nanoseconds since 1970, as text; milliseconds padded with zeros keep it exact in JavaScript.
const nanos = (ms: number) => `${Math.round(ms)}000000`;
const elapsed = (ms: number, startMs: number) => ((ms - startMs) / 1000).toFixed(3);
