# FairDrive app

One Expo app, two faces:

- **On a phone:** the driver app. Onboarding, then sign up or sign in. Four tabs:
  - **Drive** records a drive (motion 50 times a second, GPS once a second), sends it to the FairDrive API on a laptop, and shows both scores with their reasons.
  - **Trips** lists your drives. Tap one for its score, reasons and route.
  - **Progress** shows your driving score over time and whether each kind of harsh moment is getting better.
  - **Profile** has privacy, location and motion help, sign out and delete account.
- **In a browser:** the FairDrive landing page, and behind **Log in** the dashboard. Insurance companies sign up there, and once the FairDrive team approves them they see their own drivers' trips with scores, reasons and the route, and run their team.

Recordings use Sensor Logger's JSON format, so FairDrive reads them unchanged.

## Run it

1. On the laptop, in the repository: `uv run fairdrive api`. Note the laptop's Wi-Fi address (Mac: System Settings → Wi-Fi → Details; Windows: `ipconfig`), for example `192.168.1.20`.
2. Install **Expo Go** on the phone (App Store or Play Store). Phone and laptop on the same Wi-Fi.
3. The app talks to the API on Railway (`https://share-drive-production.up.railway.app`, set in `src/config.ts`), so the phone only needs internet. To use an API on your laptop instead, change that line to the laptop's Wi-Fi address, for example `http://192.168.1.20:8000`.
4. On the laptop, in `mobile/`: `npm install`, then `npx expo start`. Scan the QR code with the phone camera (iPhone) or Expo Go (Android).
5. In the app: go through the three intro screens, then **Create account**: choose your insurance company, then your name, email and a password. Then **Start drive**, and allow location and motion when asked.

The app stays signed in on the phone (stored in the phone's secure storage) until you sign out.

## Dashboard

1. Make a FairDrive super admin (once), in the repository: `uv run fairdrive add-admin you@example.com`. It asks for a password (at least 8 characters).
2. Start the API: `uv run fairdrive api`.
3. In `mobile/`: `npx expo start --web`, or press `w` in a running `npx expo start`. It opens in the browser. The dashboard talks to the same API as the phone app (`src/config.ts`).
4. An insurance company clicks **Sign up your company**. As the super admin, log in and approve it under **Companies**.
5. The company's owner logs in, sees **Trips** and **Drivers** for drivers who chose that company, and adds people under **Team**: each gets a one-time link (`/admin?invite=…`) to set their own password.

## Code

- `src/app/` holds the screens (Expo Router: each file is a screen). `_layout.tsx` decides which screens are open: onboarding first, then sign in, then the tabs.
- `src/session.tsx` keeps the sign-in. `src/fairdrive.ts` talks to the API at the address in `src/config.ts`.

## Limits

- **Keep the app open on screen.** Phones stop motion readings when an app goes to the background. The app keeps the screen awake while recording; mount the phone and keep it charging. Recording with the screen locked needs a custom build.
- **Drive at least 3 km.** FairDrive hides 500 m at each end and scores whole kilometres.
- **Save recording** shares the JSON file, for example to keep it or upload it later.
- **No password reset by email.** A forgotten password means deleting the driver from `data/drivers.json` on the server and signing up again.
- **In Expo Go, location and motion permissions belong to Expo Go,** not FairDrive. The app's help screen says where to find them.
