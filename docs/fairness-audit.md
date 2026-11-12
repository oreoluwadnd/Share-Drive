# FairDrive fairness audit (FD-29)

Data: UAH-DriveSet, 6 drivers, 37 scored trips (see `docs/model-cards.md`). Every result names the command that produces it. "Old score" is the baseline: harsh moments per km compared with the average trip, ignoring conditions.

## Summary

| Test | Target | Measured | Met | Reproduce |
|---|---|---|---|---|
| Road type doesn't leak into the score (FD-24) | gap at least 50% smaller than the old score's | **93% smaller** (1.3 vs 18.9 points) | yes | `fairdrive leakage` |
| Guessing road type from the score (FD-24) | close to chance (0.50) | **0.57** (old score 0.62) | yes | `fairdrive leakage` |
| Darkness doesn't leak (FD-24) | as above | no verdict: 4 night trips, need 10 | not tested | `fairdrive leakage` |
| Same driver, steadier score (FD-20) | at least 30% less variation | **-0.4%** (no difference) | no | `fairdrive stability` |
| Same, normal driving only | | **61.6%** less | yes | `fairdrive stability` (by-style table) |
| Phone type (FD-25) | score noise reported per phone | one phone in the data so far | not tested | `fairdrive phones` |
| Driver attention (FD-32 to 34) | | cut from the project | | |

## 1. Context leakage (FD-24)

If the score still reveals where someone drove, drivers are rewarded or punished for their roads, not their driving.

- **Urban vs mostly highway** (22 vs 15 trips). Old score: city trips average 70.1, highway 51.2, an 18.9-point gap. FairDrive: 59.0 vs 57.7, a 1.3-point gap. From the score alone, a cut-off learned on other drivers guesses the road type right 62% of the time with the old score and 57% with FairDrive (50% = coin flip). Both are close to chance with this few trips, so the gap is the stronger evidence.
- **Night vs day.** Only 4 night trips, so the test gives no verdict. Our own Ontario night drives are needed.
- **Planted test** (identical driving placed on city and highway roads, by day and night, in `tests/test_sprint3.py`): FairDrive's gap is 99.6% smaller than the old score's.

Note: in UAH, "urban" trips are on secondary roads between towns, not city streets. The old score favoured them because those roads brought fewer harsh moments.

## 2. Same driver, same score (FD-20)

Each UAH driver drove each style (normal, aggressive, drowsy) on a motorway and on a secondary road. If the score measures driving, those trips should score alike. Variation = variance of the driver's trip scores, averaged over drivers.

| Style | FairDrive | Old score | Change |
|---|---|---|---|
| Normal | 62.5 | 162.6 | **61.6% less** |
| Aggressive | 230.8 | 239.2 | 3.5% less |
| Drowsy | 197.4 | 68.7 | 187% **more** |
| All | 152.3 | 151.7 | 0.4% **more** |

**Why drowsy gets worse.** The model learned from all drivers that motorways bring about twice the harsh moments of secondary roads. Normal drivers follow that (0.41 vs 0.10 per km), so correcting for it makes their scores steadier. Drowsy drivers in UAH do the opposite (0.43 on motorways, 0.54 on secondary roads), so the same correction pushes their two trips apart (67 vs 43 on average). FairDrive assumes conditions affect everyone the same way; drowsy driving breaks that.

**The overall number is fragile.** Each driver has only 2 or 3 trips per style. Removing a single trip (D3's normal motorway trip, flagged for an 8-second gap in its motion readings) moved the overall result from 9.4% to -0.4%. The normal-driving result moved much less (64.7% to 61.6%).

**Not tuned to pass.** Changing the model until this number reaches 30% on six drivers would only fit these six drivers.

## 3. Phone type (FD-25)

Uploads now record the phone model. `fairdrive phones` reports per phone: accelerometer noise while stopped (pure sensor noise) and how much a driver's score varies between trips on that phone. UAH used a single phone (score spread 15.0; no noise reading, because its trips never stop once the ends are cut). The test needs drives from at least an iPhone and an Android phone.

## 4. Old score vs FairDrive by group (FD-21)

| Group | Trips | Old score | FairDrive |
|---|---|---|---|
| All trips | 37 | 62.5 | 58.5 |
| Night | 4 | 76.7 | 64.5 |
| Daytime | 33 | 60.7 | 57.8 |
| Urban (mostly not highway) | 22 | 70.1 | 59.0 |
| Mostly highway | 15 | 51.2 | 57.7 |
| High-mileage drivers | 21 | 66.9 | 63.1 |
| Other drivers | 16 | 56.7 | 52.5 |

*Reproduce: `fairdrive compare`.*

## What's needed to finish

1. Ontario drives on city streets, highways, at night and in rain, ideally the same drivers driving normally in each. This tests darkness leakage, weather, and stability on Canadian roads.
2. The same drives on at least two phone types.
