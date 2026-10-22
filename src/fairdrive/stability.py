"""Score stability across conditions (FD-20).

The same driver driving the same way should get the same driving score on any road. For each driver
(and driving style, when the data labels it) we measure how much their scores vary between trips,
for FairDrive and for the baseline. Both use the same 0 to 100 scale (50 = normal).
"""

import pandas as pd

TARGET_REDUCTION_PCT = 30.0


def stability(scores: pd.DataFrame) -> dict:
    keys = ["driver", "style"]
    scores = scores.assign(style=scores["style"].fillna("unlabelled"))
    groups = scores.groupby(keys).filter(lambda g: len(g) >= 2).groupby(keys)
    per_group = groups.agg(trips=("trip_id", "size"),
                           fairdrive_variance=("driving_score", lambda s: s.var(ddof=0)),
                           baseline_variance=("baseline_score", lambda s: s.var(ddof=0)))
    fairdrive, base = per_group["fairdrive_variance"].mean(), per_group["baseline_variance"].mean()
    reduction = 100 * (1 - fairdrive / base)
    return {
        "groups": int(len(per_group)),
        "fairdrive_variance": round(fairdrive, 1),
        "baseline_variance": round(base, 1),
        "reduction_pct": round(reduction, 1),
        "meets_target": bool(reduction >= TARGET_REDUCTION_PCT),
        "per_group": per_group.round(1).reset_index(),
    }
