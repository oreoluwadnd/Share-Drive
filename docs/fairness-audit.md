# FairDrive fairness audit (FD-29)

Data: UAH-DriveSet, 6 drivers, 38 scored trips (see `docs/model-cards.md`). Every result names the command that produces it. "Old score" is the baseline: harsh moments per km compared with the average trip, ignoring conditions.

## Summary

| Test | Target | Measured | Met | Reproduce |
|---|---|---|---|---|
| Road type doesn't leak into the score (FD-24) | gap at least 50% smaller than the old score's | **96% smaller** (0.7 vs 17.5 points) | yes | `fairdrive leakage` |
| Guessing road type from the score (FD-24) | close to chance (0.50) | **0.53** (old score 0.69) | yes | `fairdrive leakage` |
| Darkness doesn't leak (FD-24) | as above | no verdict: 4 night trips, need 10 | not tested | `fairdrive leakage` |
| Same driver, steadier score (FD-20) | at least 30% less variation | **9.4%** less | no | `fairdrive stability` |
| Same, normal driving only | | **64.7%** less | yes | `fairdrive stability` (by-style table) |
| Phone type (FD-25) | score noise reported per phone | one phone in the data so far | not tested | `fairdrive phones` |
| Driver attention (FD-32 to 34) | | cut from the project | | |

## 1. Context leakage (FD-24)

If the score still reveals where someone drove, drivers are rewarded or punished for their roads, not their driving.

- **Urban vs mostly highway** (22 vs 16 trips). Old score: city trips average 69.7, highway 52.2, a 17.5-point gap. FairDrive: 58.6 vs 57.9, a 0.7-point gap. From the score alone, a cut-off learned on other drivers guesses the road type right 69% of the time with the old score and 53% with FairDrive (50% = coin flip).
- **Night vs day.** Only 4 night trips, so the test gives no verdict. Our own Ontario night drives are needed.
- **Planted test** (identical driving placed on city and highway roads, by day and night, in `tests/test_sprint3.py`): FairDrive's gap is 99.6% smaller than the old score's.

Note: in UAH, "urban" trips are on secondary roads between towns, not city streets. The old score favoured them because those roads brought fewer harsh moments.

## 2. Same driver, same score (FD-20)

Each UAH driver drove each style (normal, aggressive, drowsy) on a motorway and on a secondary road. If the score measures driving, those trips should score alike. Variation = variance of the driver's trip scores, averaged over drivers.

| Style | FairDrive | Old score | Change |
|---|---|---|---|
| Normal | 61.2 | 173.4 | **64.7% less** |
| Aggressive | 208.8 | 241.6 | 13.6% less |
| Drowsy | 186.7 | 70.3 | 165% **more** |
| All | 142.4 | 157.2 | 9.4% less |

**Why drowsy gets worse.** The model learned from all drivers that motorways bring about twice the harsh moments of secondary roads. Normal drivers follow that (0.37 vs 0.10 per km), so correcting for it makes their scores steadier. Drowsy drivers in UAH do the opposite (0.43 on motorways, 0.54 on secondary roads), so the same correction pushes their two trips apart (66 vs 42). FairDrive assumes conditions affect everyone the same way; drowsy driving breaks that.

**Not tuned to pass.** Changing the model until this number reaches 30% on six drivers would only fit these six drivers.

## 3. Phone type (FD-25)

Uploads now record the phone model. `fairdrive phones` reports per phone: accelerometer noise while stopped (pure sensor noise) and how much a driver's score varies between trips on that phone. UAH used a single phone (score spread 14.3; no noise reading, because its trips never stop once the ends are cut). The test needs drives from at least an iPhone and an Android phone.

## 4. Old score vs FairDrive by group (FD-21)

| Group | Trips | Old score | FairDrive |
|---|---|---|---|
| All trips | 38 | 62.4 | 58.3 |
| Night | 4 | 76.3 | 63.6 |
| Daytime | 34 | 60.7 | 57.6 |
| Urban (mostly not highway) | 22 | 69.7 | 58.6 |
| Mostly highway | 16 | 52.2 | 57.9 |
| High-mileage drivers | 21 | 66.4 | 62.2 |
| Other drivers | 17 | 57.4 | 53.3 |

*Reproduce: `fairdrive compare`.*

## What's needed to finish

1. Ontario drives on city streets, highways, at night and in rain, ideally the same drivers driving normally in each. This tests darkness leakage, weather, and stability on Canadian roads.
2. The same drives on at least two phone types.
