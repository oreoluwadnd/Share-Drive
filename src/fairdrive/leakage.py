"""Context leakage check (FD-24): does the driving score still give away the trip's conditions?

If it does, drivers are being rewarded or punished for where and when they drive. Two tests per context:
the gap between the average scores of the two groups, and how well the score alone can guess the group
for drivers it never saw (balanced accuracy, so chance is always 50%). Both are run on FairDrive and on
the baseline.
"""

import numpy as np
import pandas as pd

from fairdrive.compare import URBAN_MAX_HIGHWAY_SHARE

TARGET_GAP_REDUCTION_PCT = 50.0
# Guessing the group this far from 50% (balanced accuracy), either way, counts as leakage.
LEAK_MARGIN = 0.10
# Fewer trips than this on either side and a single trip decides the result.
MIN_TRIPS_PER_SIDE = 10
SCORES = {"fairdrive": "driving_score", "baseline": "baseline_score"}


def contexts(scores: pd.DataFrame) -> dict[str, pd.Series]:
    return {
        "Urban vs mostly highway": scores["highway_share"] < URBAN_MAX_HIGHWAY_SHARE,
        "Night vs daytime": scores["is_dark"].astype(bool),
    }


def leakage(scores: pd.DataFrame) -> pd.DataFrame:
    """One row per context. Contexts with too few trips on one side are listed without results."""
    rows = []
    for name, group in contexts(scores).items():
        row = {"context": name, "trips": len(scores), "in_group": int(group.sum())}
        if min(group.sum(), (~group).sum()) < MIN_TRIPS_PER_SIDE:
            rows.append(row)
            continue
        for label, column in SCORES.items():
            row[f"{label}_gap"] = abs(scores.loc[group, column].mean() - scores.loc[~group, column].mean())
            row[f"{label}_guess_accuracy"] = guess_accuracy(scores[column], group, scores["driver"])
        # No baseline gap means the conditions made no difference to remove.
        row["gap_reduction_pct"] = 100 * (1 - row["fairdrive_gap"] / row["baseline_gap"]) if row["baseline_gap"] > 0 else np.nan
        row["meets_target"] = bool(row["gap_reduction_pct"] >= TARGET_GAP_REDUCTION_PCT)
        row["fairdrive_leaks"] = bool(abs(row["fairdrive_guess_accuracy"] - 0.5) > LEAK_MARGIN)
        rows.append(row)
    return pd.DataFrame(rows, columns=["context", "trips", "in_group", "fairdrive_gap", "fairdrive_guess_accuracy", "baseline_gap",
                                       "baseline_guess_accuracy", "gap_reduction_pct", "meets_target", "fairdrive_leaks"]).round(3)


def guess_accuracy(score: pd.Series, group: pd.Series, driver: pd.Series) -> float:
    """Balanced accuracy of guessing the group from the score with one cut-off, learned without the driver."""
    guess = pd.Series(False, index=score.index)
    for d in driver.unique():
        held_out = driver == d
        cut, above_means_group = _best_cut(score[~held_out], group[~held_out])
        guess[held_out] = (score[held_out] >= cut) == above_means_group
    return _balanced_accuracy(group, guess)


def _best_cut(score: pd.Series, group: pd.Series) -> tuple[float, bool]:
    best = (-1.0, 0.0, True)
    for cut in np.unique(score):
        for above_means_group in (True, False):
            accuracy = _balanced_accuracy(group, (score >= cut) == above_means_group)
            if accuracy > best[0]:
                best = (accuracy, cut, above_means_group)
    return best[1], best[2]


def _balanced_accuracy(group: pd.Series, guess: pd.Series) -> float:
    rates = [(guess[group == side] == side).mean() for side in (True, False) if (group == side).any()]
    return float(np.mean(rates))
