# FairDrive

Driving scores that judge you against what is normal for your roads, time and weather.

Each trip gets two scores from 0 to 100:

- **Driving score** (yours to control): your harsh moments compared with what is normal for the trip's roads, darkness and weather. 50 = exactly normal, 100 = none, and each further "normal amount" halves the score.
- **Conditions score** (100 = easiest): how many harsh moments those conditions usually bring, compared with the average trip.

The **old score** uses the same scale but compares you with the average trip, ignoring conditions.

Reports: [final report](docs/final-report.md), [model cards](docs/model-cards.md), [fairness audit](docs/fairness-audit.md).

## Setup

On a Mac, LightGBM needs OpenMP once: `brew install libomp`.

```
uv sync
uv run pytest
```

## Demo

```
rm -rf data                                        # start clean
uv run fairdrive load-uah ~/Downloads/uah-text/UAH-DRIVESET-v1
uv run fairdrive tag                               # adds time of day; UAH roads come with the dataset
uv run fairdrive dashboard                         # opens http://localhost:8501
```

In the dashboard: upload a Sensor Logger JSON export in the sidebar, press **Add road, time and weather**, and the trip appears in **My trips** with both scores. **Trip details** shows the reasons, the route, speed against the limit and hard brakes. **FairDrive vs old score** compares groups and downloads a CSV. **Score stability** shows how much each driver's score varies between trips.

## Commands

```
uv run fairdrive upload recording.json --driver ana   # check, clean, split and save trips
uv run fairdrive load-uah path/to/UAH-DRIVESET-v1     # load the UAH-DriveSet public dataset
uv run fairdrive tag                                  # road type, speed limit, time of day, weather (needs internet for phone trips)
uv run fairdrive trips                                # list trips (flagged ones are not scored)
uv run fairdrive summary                              # drivers, trips and km per source
uv run fairdrive baseline                             # old score per driver
uv run fairdrive train                                # test the context model on drivers it never saw
uv run fairdrive scores                               # driving and conditions score per trip
uv run fairdrive compare --csv compare.csv            # FairDrive vs old score by group
uv run fairdrive stability                            # how much each driver's score varies between trips
uv run fairdrive leakage                              # does the score give away road type or darkness?
uv run fairdrive phones                               # sensor noise and score spread per phone model
uv run fairdrive braking-study path/to/UAH-DRIVESET-v1 # can the phone tell planned stops from panic stops?
uv run fairdrive dashboard                            # the web dashboard
uv run fairdrive api                                  # scores over HTTP on port 8000 (docs at http://localhost:8000/docs)
uv run fairdrive add-admin you@example.com            # FairDrive super admin for the web dashboard (asks for a password)
uv run fairdrive seed-demo                            # demo companies, and 150 drivers with trips on London, Ontario roads
```

`tag` can be re-run any time. It skips trips that are done and fills in weather that Environment Canada hadn't published yet (it runs a few days behind).

For UAH-DriveSet only the `.txt` files are needed (about 13 MB zipped, versus 3.5 GB with videos):

```
unzip -q UAH-DRIVESET-v1.zip '*.txt' -d uah-text
```

## How it works

- A **harsh moment** is a push of 0.15 g or more: braking, speeding up or turning. Pushes within 1 second count once.
- The **context model** (LightGBM, one per kind of harsh moment) predicts how many harsh moments per km are normal for a road type, speed limit, darkness and weather. Hour and weekday are left out: in UAH-DriveSet they identified the driver rather than the conditions.
- Every trip is scored by a model trained **without that driver's trips**, so it can't memorise their own harsh moments.
- Trips are saved under `data/`. Raw sensor data is never saved, and the first and last 500 m of each trip are removed.
- Recordings where the phone moved (sideways pushes above 0.3 g for more than 5% of the trip) are flagged and not scored.
- Trips with a GPS gap over 30 seconds, or motion readings missing for over 2 seconds (the phone paused the app), are flagged and not scored.

## API

Drivers sign up in the phone app. Every call except sign up and sign in needs the token it returns. The full list is at the top of `src/fairdrive/api.py`.

```
curl localhost:8000/companies                                                     # insurance companies a driver can choose
curl -X POST localhost:8000/auth/signup -H 'Content-Type: application/json' \
     -d '{"name": "Ana", "email": "ana@example.com", "password": "at least 8 chars", "company_id": "c1a2b3c4"}'   # -> {"token": ...}
curl -H "Authorization: Bearer $TOKEN" -F file=@recording.json localhost:8000/trips   # upload, then add road, time and weather
curl -H "Authorization: Bearer $TOKEN" localhost:8000/me/trips                       # your trips, with scores
curl -H "Authorization: Bearer $TOKEN" localhost:8000/me/trips/<trip_id>             # one trip: scores, reasons and route
curl -H "Authorization: Bearer $TOKEN" -X DELETE localhost:8000/me                   # delete the account and all its trips
```

A file that can't be used gets a 400 that names the problem. Drivers only ever see their own trips. Passwords are stored only as salted hashes (`data/drivers.json`, `data/staff.json`), and sign-ins are saved in `data/sessions.json` (only a hash of each token), so restarting the API doesn't sign anyone out. A driver stays signed in for 90 days, dashboard staff for 12 hours.

**Insurance companies.** A company signs up on the web dashboard and waits until a FairDrive super admin approves it (`data/companies.json`). Then drivers can choose it when they sign up in the app, and its owner and team see only those drivers and their trips. The owner invites team members with one-time links (`data/invites.json`, valid 7 days) and can remove team members and drivers. Scores still compare every driver against the same idea of normal, learned from every company's drives, so a company with few drivers still gets scores.

The landing page and the web dashboard (trips with scores, reasons and route; drivers; team; companies) are the same Expo app opened in a browser; see `mobile/README.md`.

**Deploying:** GitHub Actions (`.github/workflows/ci.yml`) checks every pull request, and on `main` deploys the landing page and dashboard to Vercel (`mobile/vercel.json`). Railway deploys the API (`Dockerfile`) from `main` once the workflow has passed. One-time setup in `docs/deploy.md`.

## Recording a drive

In Sensor Logger, switch on **Accelerometer**, **Gravity** and **Location**, and give it location access **Always** (iPhone: Settings → Sensor Logger → Location → Always, Precise on). Without location an iPhone pauses the app when the screen locks. Export the recording as **JSON**. Or record with the FairDrive phone app in `mobile/`, which sends the trip straight to the API and shows the scores (see `mobile/README.md`).

Keep the phone in one mount position for the whole drive. Acceleration is turned into the car's forward, sideways and vertical directions using GPS, which only works if the phone stays still in its mount.
