# FairDrive app

One Expo app, two faces:

- **On a phone:** the driver app. Onboarding, then sign up or sign in. Four tabs:
  - **Drive** records a drive (motion 50 times a second, GPS once a second), sends it to the FairDrive API on a laptop, and shows both scores with their reasons.
  - **Trips** lists your drives. Tap one for its score, reasons and route.
  - **Progress** shows your driving score over time and whether each kind of harsh moment is getting better.
  - **Profile** has privacy, location and motion help, sign out and delete account.
- **In a browser:** the FairDrive landing page, and behind **Admin login** the admin dashboard, where admins see every trip with scores, reasons and the route.

Recordings use Sensor Logger's JSON format, so FairDrive reads them unchanged.

## Run it

1. On the laptop, in the repository: `uv run fairdrive api`. Note the laptop's Wi-Fi address (Mac: System Settings → Wi-Fi → Details; Windows: `ipconfig`), for example `192.168.1.20`.
2. Install **Expo Go** on the phone (App Store or Play Store). Phone and laptop on the same Wi-Fi.
3. On the laptop, in `mobile/`: `npm install`, then `npx expo start`. Scan the QR code with the phone camera (iPhone) or Expo Go (Android).
4. In the app: go through the three intro screens, then **Create account** with your name, email, a password and the server, e.g. `192.168.1.20:8000`. Then **Start drive**, and allow location and motion when asked.

The app stays signed in on the phone (stored in the phone's secure storage) until you sign out.

## Admin dashboard

1. Make an admin account (once), in the repository: `uv run fairdrive add-admin you@example.com`. It asks for a password (at least 8 characters).
2. Start the API: `uv run fairdrive api`.
3. In `mobile/`: `npx expo start --web`, or press `w` in a running `npx expo start`. It opens in the browser.
4. Log in with the server (`localhost:8000` on the same laptop), your email and password.

## Code

- `src/app/` holds the screens (Expo Router: each file is a screen). `_layout.tsx` decides which screens are open: onboarding first, then sign in, then the tabs.
- `src/session.tsx` keeps the sign-in. `src/fairdrive.ts` talks to the API.

## Limits

- **Keep the app open on screen.** Phones stop motion readings when an app goes to the background. The app keeps the screen awake while recording; mount the phone and keep it charging. Recording with the screen locked needs a custom build.
- **Drive at least 3 km.** FairDrive hides 500 m at each end and scores whole kilometres.
- **Save recording** shares the JSON file, for example to keep it or upload it later.
- **No password reset by email.** A forgotten password means deleting the driver from `data/drivers.json` on the server and signing up again.
- **In Expo Go, location and motion permissions belong to Expo Go,** not FairDrive. The app's help screen says where to find them.
