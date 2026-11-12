# FairDrive model cards (FD-27)

Every number below comes from a command in this repository. Run it on the same data and you get the same number (all models use a fixed seed). "UAH data" means `fairdrive load-uah` then `fairdrive tag` on UAH-DriveSet v1.

---

## 1. Context model

**Purpose.** Predicts how many harsh moments per km are normal for a trip's conditions, so a driver is compared with others on the same kind of road, light and weather. It is what turns "you braked hard 4 times" into "4 is more than the 1 that is normal here".

**What it is.** Three LightGBM models (Poisson, one each for hard braking, sharp speeding up and sharp turns), trained on 1 km pieces of trips. Small trees (7 leaves, at least 30 km per leaf, 150 rounds) because the data is small. Code: `src/fairdrive/model.py`.

**Inputs (conditions only, never the driving).** Share of the km on highways, share on main roads, speed limit, dark or not, temperature, rain, visibility.

**Left out on purpose.** Hour of day and weekday. In UAH data each driver drove at their own times, so these let the model recognise the driver instead of the conditions. With them the model was 1.1% better than a simple average on unseen drivers; without them, 21.6% (measured in Sprint 2, on the trips kept at the time).

**Data.** UAH-DriveSet: 6 drivers in Spain, 2015, 40 trips (698.9 km kept after hiding the first and last 500 m). 37 trips are scored; 3 are flagged: 2 because the phone moved, 1 because its motion readings stop for 8 seconds mid-trip. Roads and speed limits come from the dataset's own OpenStreetMap readings. *Reproduce: `fairdrive summary`.*

**How it was tested.** Leave one driver out: train on 5 drivers, predict the 6th, for every driver. Error is mean Poisson deviance (the standard error measure for counts).

| Measure | Result | Target | Met | Reproduce |
|---|---|---|---|---|
| Error, context model | 1.482 | | | `fairdrive train` → `data/model/evaluation.json` |
| Error, simple average | 1.915 | | | same |
| Improvement on unseen drivers | **22.6%** | at least 10% | yes | same |

**How scores use it.** Each trip is scored with a model trained without that trip's driver, so it can't memorise the driver's own harsh moments (in-sample, the expected rate followed each trip's own rate: correlation 0.61; held out: -0.02).

**Fairness results.** See `docs/fairness-audit.md`. In short: the score no longer gives away road type (gap between road types 93% smaller than the old score's), but it is not yet steadier for drowsy or aggressive driving.

**Known limitations.**
- **Spanish roads only.** No Canadian trips yet, so no proof it transfers to Ontario roads.
- **Weather not learned.** UAH has no weather (Environment Canada only covers Canada), so the weather inputs are empty in training. The model can't yet say what rain or snow does.
- **Night barely covered.** 4 of 37 trips were in the dark.
- **Same effect for everyone.** The model assumes conditions change every driver's harsh moments the same way. True for normal driving; not for drowsy driving, which in UAH is harsher on secondary roads than on motorways (0.54 vs 0.43 harsh moments per km). FairDrive then over-corrects drowsy drivers' trips.
- **Small zero-event effect.** The score adds 1 to both counts so a short trip with one event isn't an extreme. As a result, a driver with no harsh moments at all scores about 3 points lower on highways (96) than in the city (99).
- **Harsh moment = 0.15 g.** Chosen because at 0.3 g only 2-4% of km had any event, too few to learn from.

---

## 2. Braking quality classifier (studied, not used)

**Purpose.** Tell planned stops from panic stops, so careful braking costs less (FD-22, FD-23).

**Label.** UAH's road camera measures the gap to the car ahead. A hard brake is "reactive" if a car was closer than 2 seconds (the Ontario driver's handbook rule) in the 3 s before it, otherwise "anticipated". The camera only makes the label; the classifier sees only what a phone records (speed and forward push from 5 s before to 3 s after the brake). Code: `src/fairdrive/braking.py`.

**Why not UAH's own braking levels.** They grade how hard the brake was (1 to 3), not whether it was planned, and they come from acceleration thresholds, so predicting them from acceleration would be circular.

| Measure | Result | Target | Met | Reproduce |
|---|---|---|---|---|
| Hard brakes / reactive | 134 / 80 | | | `fairdrive braking-study <UAH folder>` → `data/model/braking_study.json` |
| Macro F1, unseen drivers | **0.521** | at least 0.80 | no | same |
| Always guessing the common label | 0.374 | | | same |
| Peak push, anticipated vs reactive (median) | 0.178 g vs 0.184 g | | | same (`median_by_label`) |

A raw 8-second motion window instead of the 7 hand-picked measures gave 0.476.

**Decision.** Not used in the score. A classifier right about half the time on new drivers would move scores at random. The phone's motion doesn't carry this signal, and 134 brakes are too few for a neural network to find one.

**What would work instead.** A phone camera facing the road (it could measure the gap to the car ahead directly).
