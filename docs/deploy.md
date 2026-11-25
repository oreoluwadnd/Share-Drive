# Deploying FairDrive

| Part | Where | Cost |
|---|---|---|
| API (`Dockerfile` in the repo root) | Railway | Hobby plan, about $5 a month |
| Landing page and admin dashboard (`mobile/`) | Vercel | Free (Hobby) |
| Phone app (`mobile/`) | Expo Go for testing, EAS Build to install | Free for Android; iPhone needs an Apple Developer account ($99 a year) |

## How deploys happen

GitHub Actions (`.github/workflows/ci.yml`) runs the checks:

- **Every pull request:** API tests, app typecheck, and a web build. Nothing is deployed.
- **Every push to `main`** (a merged pull request): the same checks, then, only if all pass, the web app is deployed to Vercel.
- **The API:** Railway watches `main` itself. With **Wait for CI** on, it deploys only after the whole workflow succeeds. A failed check, or a failed Vercel deploy, means no API deploy either.

Don't connect Vercel to the GitHub repository: it would deploy on its own as well, skipping the checks.

Add GitHub secrets under the repository's **Settings → Secrets and variables → Actions**.

## 1. Railway (API)

1. railway.com → **New Project** → **Deploy from GitHub repo** → pick this repository. Railway finds the `Dockerfile`.
2. Service → **Settings → Source**:
   - **Branch connected to production**: `main`.
   - Turn on **Wait for CI**, and accept Railway's updated GitHub permissions when it asks. Without it, Railway deploys even when tests fail.
3. Add a **volume** to the service with mount path **`/data`**. Accounts, sign-ins and trips live there. Without it they are lost on every deploy.
4. Service → **Settings**:
   - **Networking** → **Generate Domain**, on the port the deploy log shows (`Uvicorn running on http://0.0.0.0:8080` means `8080`; Railway sets `PORT` itself). Note the address, for example `https://share-drive-production.up.railway.app`.
   - **Healthcheck path**: `/docs`.
   - Keep **1 replica**. Accounts and sign-ins are files with in-process locks, so two copies would clash.

Check it worked: `https://<your address>/docs` shows the API documentation.

### Admin account and the UAH-DriveSet trips (once, after the first deploy)

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

## 2. Vercel (landing page and admin dashboard)

1. On your laptop, in `mobile/`: `npx vercel@66.6.0 link`, and create a new project when asked. This makes the project without connecting GitHub, and writes `mobile/.vercel/project.json` (git ignores it).
2. Copy `orgId` and `projectId` from `mobile/.vercel/project.json`.
3. In the Vercel project → **Settings → Environment Variables**: add `EXPO_PUBLIC_API_URL` = the Railway address, for **Production**.
4. vercel.com → **Account Settings → Tokens** → create a token.
5. In GitHub, secrets:
   - `VERCEL_TOKEN` = that token
   - `VERCEL_ORG_ID` = `orgId`
   - `VERCEL_PROJECT_ID` = `projectId`

The API address is built into the site, so after changing `EXPO_PUBLIC_API_URL`, push to `main` again (or re-run the workflow) to rebuild.

`mobile/vercel.json` builds the web export and sends every page to `index.html`, so `/admin` opens directly.

## If a deploy fails

Open the failed run under the repository's **Actions** tab:

- **"Add the … secret"**: a secret or variable from the steps above is missing.
- **The API didn't update:** Railway waits for the whole workflow. If any job failed (the Vercel deploy too), Railway skips that commit. Fix the failed job, then push again or re-run the workflow.
- **The API failed to build or start:** see the service's **Deployments** in Railway.

## 3. Phone app

**Testing with Expo Go:** in `mobile/`, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL` to the Railway address, then `npx expo start`. Drivers' phones talk to Railway, so they no longer need to be on the laptop's Wi-Fi to send drives. The laptop still serves the app to Expo Go: use `npx expo start --tunnel` if the phone isn't on the same Wi-Fi.

**An installable app:** run `npx eas-cli@latest build:configure` in `mobile/` (it links the app to an Expo account), add `EXPO_PUBLIC_API_URL` on the project's **Environment variables** page in the Expo dashboard, then:

- Android: `npx eas-cli@latest build --platform android --profile preview` gives a link to an `.apk` that anyone can install.
- iPhone: needs an Apple Developer account, then `npx eas-cli@latest build --platform ios` and TestFlight.

## Before real drivers use it

- The admin dashboard and API are public on the internet. Use a long admin password.
- There is no password reset by email yet.
- Scores are recomputed for every trip whenever a trip is added. That's fine for a class project, but it slows down with hundreds of drivers.
