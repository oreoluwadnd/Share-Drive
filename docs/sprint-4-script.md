# Sprint 4 presentation script

Six parts, about 40 seconds each. With fewer than six people, give someone two parts. Numbers are from UAH-DriveSet (Spain, 6 drivers, 37 scored trips); `docs/final-report.md` says which command reproduces each one.

## Person 1: What Sprint 4 was about

"Sprint 4 had one goal: finish FairDrive and prove it's fair. At the start we made two honest calls. We cut driver attention from video, because the Spanish dataset only films the road, not the driver. And we tested braking quality and found it doesn't work from phone data, so we left it out rather than put a weak result into people's scores. Everything else on the plan is built, and 63 automated tests pass."

## Person 2: The phone app

"We built a FairDrive phone app. You type your name, tap Start, and drive. A car on the screen drives along a road that moves with your speed. When you stop, the app sends the drive to FairDrive and shows your score in a ring that fills up, plus a one-line tip like 'Watch your braking', and a breakdown of hard braking, sharp speeding up and sharp turns, each compared with what's normal. We based the design on real apps like Oura and State Farm's Drive Safe and Save."

## Person 3: Is the score fair?

"The main question of the project is whether the score judges your driving or your roads. With the old score, trips on secondary roads scored 18.9 points higher than motorway trips. With FairDrive the gap is 1.3 points, 93% smaller. Our target was 50%. We also checked whether the score gives away the road type. FairDrive guesses it at 57%, close to a coin flip, while the old score guesses it at 62%."

## Person 4: What didn't work, and why that matters

"Not everything met its target, and we report that honestly. For stability, normal drivers' scores became 62% steadier, but drowsy drivers didn't, because drowsy drivers are harsher on small roads, the opposite of everyone else. For braking, the phone could only tell a planned stop from a panic stop about half the time, so we left it out of the score. We also tested other models, and our tree model did best: 22.6% better than a simple average, against 7.5% for a classic statistics model."

## Person 5: Testing and the bug we caught

"For testing, we ran ten recordings through the whole system, from upload to explained score, with no errors. Testing also caught a real bug. When a phone paused the app, the system quietly filled in the missing motion. We fixed it so those trips are flagged instead. That showed one of the Spanish trips had eight seconds of made-up data, so we removed it and re-ran every result. We also built a check for whether cheaper phones get noisier scores. That needs drives on different phones."

## Person 6: Reports and what's next

"We wrote three documents: a final report, model cards that explain each model and its limits, and a fairness audit. Every number in them comes from a command anyone can re-run. What's left is real Canadian data. Everything so far is tested on Spanish roads from 2015. Our next step is recording Ontario drives in the city, on highways, at night and in rain, on iPhone and Android, to confirm the results on Canadian roads."

## Likely questions

Whoever covered that part answers.

- **"Why did stability miss its target?"** (Person 4) Drowsy drivers behave the opposite way on different roads, and there are only 2 or 3 trips per driver, so one trip can swing the number.
- **"Why LightGBM?"** (Person 4) We tested a table of averages, a statistics model and LightGBM on drivers they never saw, and LightGBM won clearly: 22.6% better than a simple average, against 7.5% and -0.7%.
- **"Has the app been tested in a real car?"** (Person 2) Answer honestly. If the test drive has happened, say so. If not: it has been checked with a simulated drive, and the real test is next.
