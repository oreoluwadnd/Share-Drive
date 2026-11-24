# Deploying FairDrive

| Part | Where | Cost |
|---|---|---|
| API (`Dockerfile` in the repo root) | Railway | Hobby plan, about $5 a month |
| Landing page and admin dashboard (`mobile/`) | Vercel | Free (Hobby) |
| Phone app (`mobile/`) | Expo Go for testing, EAS Build to install | Free for Android; iPhone needs an Apple Developer account ($99 a year) |

Deploy the API first: the web app and phone app need its address.

## 1. API on Railway

1. railway.com → **New Project** → **Deploy from GitHub repo** → pick this repository. Railway finds the `Dockerfile` and builds it.
2. Service → **Variables** → add `PORT` = `8000`.
3. Add a **volume** to the service with mount path **`/data`**. Accounts, sign-ins and trips live there. Without it they are lost on every deploy.
4. Service → **Settings**:
   - **Networking** → **Generate Domain**, port `8000`. Note the address, for example `https://fairdrive-api.up.railway.app`.
   - **Healthcheck path**: `/docs`.
   - Keep **1 replica**. Accounts and sign-ins are files with in-process locks, so two copies would clash.
5. Check: opening `https://<your address>/docs` shows the API documentation.

### Admin account and the UAH-DriveSet trips (once)

Scoring needs tagged trips from at least 2 drivers before it can score anyone, so load UAH-DriveSet once. Install the Railway CLI, then in this repository run `railway link` and pick the project.

On your laptop, pack the UAH text files (13 MB):

```
unzip -q UAH-DRIVESET-v1.zip '*.txt' -d uah-text
tar czf uah-text.tgz -C uah-text .
railway volume files upload uah-text.tgz /uah-text.tgz
```

Then open a shell on the server with `railway ssh` and run:

```
ls /data                                   # uah-text.tgz should be here
mkdir -p /data/uah-text && tar xzf /data/uah-text.tgz -C /data/uah-text
fairdrive load-uah /data/uah-text/UAH-DRIVESET-v1
fairdrive tag                              # road, time and weather; takes a few minutes
fairdrive summary                          # expect 6 drivers
rm -rf /data/uah-text /data/uah-text.tgz   # the raw files aren't needed any more
fairdrive add-admin you@example.com        # asks for a password
```

On the server, `fairdrive` commands use `/data` by themselves (the image sets `FAIRDRIVE_DATA=/data`). If `uah-text.tgz` isn't in `/data`, `railway volume browse` shows where the upload went.

## 2. Landing page and admin dashboard on Vercel

1. vercel.com → **Add New Project** → import this repository.
2. **Root Directory**: `mobile`. `mobile/vercel.json` sets the build command, the `dist` output folder, and sends every page to `index.html`.
3. **Environment Variables**: `EXPO_PUBLIC_API_URL` = the Railway address from step 1.
4. **Deploy.** Then open `/admin` and log in with the admin account.

The API address is built into the site, so after changing `EXPO_PUBLIC_API_URL`, redeploy.

## 3. Phone app

**Testing with Expo Go:** in `mobile/`, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL` to the Railway address, then `npx expo start`. Drivers' phones talk to Railway, so they no longer need to be on the laptop's Wi-Fi to send drives. The laptop still serves the app to Expo Go: use `npx expo start --tunnel` if the phone isn't on the same Wi-Fi.

**An installable app:** run `npx eas-cli@latest build:configure` in `mobile/` (it links the app to an Expo account), add `EXPO_PUBLIC_API_URL` on the project's **Environment variables** page in the Expo dashboard, then:

- Android: `npx eas-cli@latest build --platform android --profile preview` gives a link to an `.apk` that anyone can install.
- iPhone: needs an Apple Developer account, then `npx eas-cli@latest build --platform ios` and TestFlight.

## Before real drivers use it

- The admin dashboard and API are public on the internet. Use a long admin password.
- There is no password reset by email yet.
- Scores are recomputed for every trip whenever a trip is added. That's fine for a class project, but it slows down with hundreds of drivers.
