"""FairDrive vs the baseline, by driver group (FD-21)."""

import pandas as pd

URBAN_MAX_HIGHWAY_SHARE = 0.5


def comparison(scores: pd.DataFrame) -> pd.DataFrame:
    """Average baseline and FairDrive driving scores for night, urban and high-mileage groups and their opposites."""
    driver_km = scores.groupby("driver")["km"].sum()
    high_mileage = driver_km[driver_km >= driver_km.median()].index
    urban = scores["highway_share"] < URBAN_MAX_HIGHWAY_SHARE
    night = scores["is_dark"].astype(bool)
    heavy = scores["driver"].isin(high_mileage)
    groups = {
        "All trips": pd.Series(True, index=scores.index),
        "Night": night, "Daytime": ~night,
        "Urban (mostly city roads)": urban, "Mostly highway": ~urban,
        "High-mileage drivers": heavy, "Other drivers": ~heavy,
    }
    rows = []
    for name, chosen in groups.items():
        part = scores[chosen]
        rows.append({
            "group": name, "trips": len(part), "drivers": part["driver"].nunique(),
            "baseline_score": part["baseline_score"].mean(), "fairdrive_score": part["driving_score"].mean(),
        })
    table = pd.DataFrame(rows)
    table["difference"] = table["fairdrive_score"] - table["baseline_score"]
    return table.round(1)
