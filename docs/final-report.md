# FairDrive final report (FD-31)

## The problem

Insurance apps score driving by counting harsh moments (hard brakes, sharp turns, fast speeding up). That punishes people for their roads: a city commute needs more braking than an empty highway, so a careful city driver can score worse than a careless highway driver.

## What FairDrive does

Each trip gets two scores from 0 to 100:

- **Driving score** (yours to control): your harsh moments compared with what is normal for the trip's roads, darkness and weather. 50 = normal, 100 = none.
- **Conditions score** (100 = easiest): how demanding the trip's conditions were.

Each score comes with three plain-language reasons. The old way of scoring is kept as the **old score** for comparison.

## How it works

1. **Record** a drive with the free Sensor Logger app and export the zip.
2. **Upload** it (dashboard, command line or API). FairDrive checks it, splits it into trips, turns the phone's readings into the car's forward, sideways and up directions using GPS (works for any mount and for iPhone and Android), and removes the first and last 500 m so home and work aren't stored.
3. **Tag** each trip with road type and speed limit (OpenStreetMap), daylight or dark, and weather (Environment Canada).
4. **Count** harsh moments: any push of 0.15 g or more; pushes within 1 second count once.
5. **Compare** with what's normal: a model trained on other drivers predicts the normal number of harsh moments for those conditions.
6. **Explain**: three reasons per score, with no technical words (checked by a test).

## Results against the project's targets

Data: UAH-DriveSet (6 drivers, 37 scored trips, 682 km, Spain). Commands reproduce every number (see `docs/model-cards.md`).

| Story | Target | Result | Met |
|---|---|---|---|
| FD-10 to 15: upload, clean, split, hide ends, old score | works end to end | done | yes |
| FD-16: predict normal harsh moments | at least 10% better than a simple average on unseen drivers | **22.6%** | yes |
| FD-17, 18: two scores, three plain reasons each | | done, tested | yes |
| FD-19: dashboard | | done (Streamlit) | yes |
| FD-20: same driver, steadier score | at least 30% less variation | **-0.4%** overall (no difference); **61.6%** for normal driving; worse for drowsy driving | no |
| FD-21: compare with old score by group | | done, CSV download | yes |
| FD-22: planned vs panic braking | macro F1 at least 0.80 | **0.521** | no |
| FD-23: weight score by braking quality | | not built (FD-22 too weak) | no |
| FD-24: no context leakage | gap at least 50% smaller | **93%** smaller for road type; night untested (4 trips) | yes, for road type |
| FD-25: fair across phones | noise reported per phone | built; needs drives from 2+ phones | pending data |
| FD-26: API | scores and reasons as JSON, 400 on bad files | done | yes |
| FD-27: model cards | | `docs/model-cards.md` | yes |
| FD-28: phone recording | | Sensor Logger used instead of building an app | by decision |
| FD-29: fairness audit | | `docs/fairness-audit.md` | yes |
| FD-30: full flow, 10 trips | all scored with reasons, no errors | 10 test recordings and all 37 scorable UAH trips pass; no open bugs | yes |
| FD-32 to 34: driver attention from video | | cut (needs video of the driver; UAH films the road) | cut |

**Tests:** 60 automated tests (`uv run pytest`), including the 10-trip end-to-end test.

## What we learned

- **Hour and weekday made the model cheat.** With them it recognised drivers by when they drove (1.1% better than average); without them, 21.6% (now 22.6%).
- **Scoring a driver with a model that saw them is unfair.** It partly memorises their own harsh moments. Every trip is scored by a model trained without that driver.
- **The old score leaks road type; FairDrive doesn't.** On UAH the old score gave secondary-road trips 18.9 points more than motorway trips. FairDrive: 1.3.
- **FairDrive assumes conditions affect everyone the same way.** True for normal driving (61.6% steadier); not for drowsy driving, which in UAH is harsher on secondary roads. That's the main limitation.
- **A phone can't tell a planned stop from a panic stop** from motion alone (F1 0.521).
- **Six drivers is too few for some measures.** Flagging one trip (an 8-second hole in its motion readings) moved overall stability from 9.4% to -0.4%.
- **Recording setup matters.** Our first real drive had no GPS (location permission off), and the iPhone paused the app when the screen locked. Uploads now say exactly what to fix.

## Limitations

- Trained only on Spanish roads from 2015. No Canadian trips yet.
- No weather in the training data, so weather effects aren't learned yet.
- Only 4 night trips.
- 6 drivers. Every number above could move with more drivers.

## Next steps

1. Record Ontario drives (city, highway, night, rain), with the same drivers driving normally in each, on at least an iPhone and an Android phone. Re-run `fairdrive train`, `stability`, `leakage` and `phones`.
2. Let the model learn how conditions affect drowsy and aggressive driving differently, once there's enough data.
3. A road-facing phone camera could measure the gap to the car ahead and make braking quality possible.

## Live demo (about 5 minutes)

```
uv sync
rm -rf data
uv run fairdrive load-uah ~/Downloads/uah-text/UAH-DRIVESET-v1
uv run fairdrive tag
uv run fairdrive train          # "22.6% better than the simple average"
uv run fairdrive dashboard      # http://localhost:8501
```

1. **My trips:** pick a driver, show both scores, the old score and the trend.
2. **Trip details:** open a trip and read the reasons. Show the route, speed against the limit, and the hard brakes on the chart.
3. **Upload:** in the sidebar, upload a Sensor Logger zip and press **Add road, time and weather**. The trip appears with scores and reasons.
4. **FairDrive vs old score:** show the urban and highway rows: the old score's 18.9-point gap, FairDrive's 1.3.
5. **Score stability:** show that normal driving is 61.6% steadier, and say plainly why drowsy driving isn't.
6. Optional: `uv run fairdrive api` and open http://localhost:8000/docs to show the API.
