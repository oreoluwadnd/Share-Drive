# FairDrive app

One Expo app, two faces:

- **On a phone:** the driver app. Records a drive (motion 50 times a second, GPS once a second), sends it to the FairDrive API on a laptop, and shows both scores with their reasons. Recordings use Sensor Logger's JSON format, so FairDrive reads them unchanged.
- **In a browser:** the admin dashboard. Admins log in and see every trip, with scores, reasons and the route.

## Run it

1. On the laptop, in the repository: `uv run fairdrive api`. Note the laptop's Wi-Fi address (Mac: System Settings → Wi-Fi → Details; Windows: `ipconfig`), for example `192.168.1.20`.
2. Install **Expo Go** on the phone (App Store or Play Store). Phone and laptop on the same Wi-Fi.
3. On the laptop, in `mobile/`: `npm install`, then `npx expo start`. Scan the QR code with the phone camera (iPhone) or Expo Go (Android).
4. In the app: enter your name and the server, e.g. `192.168.1.20:8000`, then **Start drive**. Allow location and motion when asked.

## Admin dashboard

1. Make an admin account (once), in the repository: `uv run fairdrive add-admin you@example.com`. It asks for a password (at least 8 characters).
2. Start the API: `uv run fairdrive api`.
3. In `mobile/`: `npx expo start --web`, or press `w` in a running `npx expo start`. It opens in the browser.
4. Log in with the server (`localhost:8000` on the same laptop), your email and password.

Passwords are stored only as salted hashes in `data/admins.json`. A login lasts 12 hours, or until the API restarts.

## Limits

- **Keep the app open on screen.** Phones stop motion readings when an app goes to the background. The app keeps the screen awake while recording; mount the phone and keep it charging. Recording with the screen locked needs a custom build.
- **Drive at least 3 km.** FairDrive hides 500 m at each end and scores whole kilometres.
- **Save recording** shares the JSON file, for example to keep it or upload it later.
- **Only the admin pages need a login.** Uploading and reading one trip's score through the API are still open to anyone on the same network, as before.
