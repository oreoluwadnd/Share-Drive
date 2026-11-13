// Records a drive and saves it in Sensor Logger's JSON format (see format.ts).

import * as Device from 'expo-device';
import { File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { Platform } from 'react-native';

import { Fix, Reading, sensorLoggerJson } from './format';

const MOTION_INTERVAL_MS = 20; // 50 readings a second

export type Live = { seconds: number; km: number; kmh: number; gpsFixes: number };

export class Recorder {
  private motion: Reading[] = [];
  private gravity: Reading[] = [];
  private fixes: Fix[] = [];
  private startMs = 0;
  private km = 0;
  private stops: (() => void)[] = [];

  async start(onLive: (live: Live) => void): Promise<void> {
    if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') {
      throw new Error('Location is off for this app. Allow it in Settings, then try again.');
    }
    if ((await DeviceMotion.requestPermissionsAsync()).status !== 'granted') {
      throw new Error('Motion access is off for this app. Allow it in Settings, then try again.');
    }
    if (!(await DeviceMotion.isAvailableAsync())) {
      throw new Error("This phone doesn't report motion.");
    }

    this.startMs = Date.now();
    DeviceMotion.setUpdateInterval(MOTION_INTERVAL_MS);
    const motion = DeviceMotion.addListener(({ acceleration, accelerationIncludingGravity: total }) => {
      if (!acceleration) return; // checked on stop: some Android phones can't separate gravity
      const ms = Date.now();
      this.motion.push([ms, acceleration.x, acceleration.y, acceleration.z]);
      this.gravity.push([ms, total.x - acceleration.x, total.y - acceleration.y, total.z - acceleration.z]);
    });
    this.stops.push(() => motion.remove());

    const gps = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      ({ coords, timestamp }) => {
        const fix = {
          ms: timestamp,
          lat: coords.latitude,
          lon: coords.longitude,
          speed: coords.speed ?? -1, // negative = unknown, as in Sensor Logger
          bearing: coords.heading ?? -1,
          accuracy: coords.accuracy ?? -1,
        };
        const last = this.fixes.at(-1);
        if (last) this.km += distanceKm(last, fix);
        this.fixes.push(fix);
        onLive({
          seconds: (fix.ms - this.startMs) / 1000,
          km: this.km,
          kmh: Math.max(fix.speed, 0) * 3.6,
          gpsFixes: this.fixes.length,
        });
      },
    );
    this.stops.push(() => gps.remove());
  }

  /** Stops recording and writes the JSON file. Throws if a sensor recorded nothing. */
  async stop(): Promise<File> {
    this.stops.forEach((stop) => stop());
    if (this.fixes.length === 0) throw new Error('No GPS readings. Check location is allowed and you can see the sky.');
    if (this.motion.length === 0) throw new Error("No motion readings. This phone can't separate gravity from motion.");

    const json = sensorLoggerJson({
      motion: this.motion, gravity: this.gravity, fixes: this.fixes, startMs: this.startMs,
      device: Device.modelName ?? 'unknown', platform: Platform.OS,
    });
    const file = new File(Paths.cache, `fairdrive-${new Date(this.startMs).toISOString().replace(/[:.]/g, '-')}.json`);
    file.create({ overwrite: true });
    await file.write(json);
    return file;
  }
}

function distanceKm(a: Fix, b: Fix): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
