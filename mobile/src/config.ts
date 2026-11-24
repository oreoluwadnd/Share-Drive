// The FairDrive API address, built into the app when it is bundled.
// Locally: put it in mobile/.env (see .env.example). Vercel and EAS: set it in their environment settings.

const url = process.env.EXPO_PUBLIC_API_URL;
if (!url) {
  throw new Error('EXPO_PUBLIC_API_URL is not set. Add it to mobile/.env, for example EXPO_PUBLIC_API_URL=http://192.168.1.20:8000');
}
export const API_URL = url.replace(/\/+$/, '');
