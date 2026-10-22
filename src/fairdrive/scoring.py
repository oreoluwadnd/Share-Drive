"""Two-part trip score (FD-17) with plain-language reasons (FD-18).

Driving score: harsh moments compared with what is normal for the trip's roads, time and weather.
50 = exactly normal, 100 = none, halving for each further 'normal' amount. It is what the driver controls.
Conditions score: how many harsh moments the conditions usually bring, compared with the average trip,
on the same scale (100 = easiest). The old score compares harsh moments with the average trip instead.
"""

import numpy as np
import pandas as pd

from fairdrive import baseline
from fairdrive.events import EVENT_TYPES
from fairdrive.features import HIGHWAY, MAIN_ROAD
from fairdrive.model import held_out_expected, training_segments
from fairdrive.scale import halving_score
from fairdrive.store import TripStore

TOP_TIER = 80
# Smooths the observed / expected ratio so a short trip with one event isn't scored as an extreme.
SMOOTHING = 1.0
VERBS = {"hard_brake": "braked hard", "hard_accel": "sped up sharply", "hard_corner": "took a sharp turn"}
ROAD_NAMES = {"highway": "highways", "main road": "main roads", "local street": "local streets"}


def conditions_tier(score: float) -> str:
    """Words for a conditions score. Hard conditions are not the driver's fault, so no advice words."""
    if score >= TOP_TIER:
        return "Easy"
    if score >= 60:
        return "Fairly easy"
    if score >= 40:
        return "Average"
    return "Demanding"


def tier(score: float) -> str:
    """Words for a driving score, so its meaning never relies on colour."""
    if score >= TOP_TIER:
        return "Excellent"
    if score >= 60:
        return "Good"
    if score >= 40:
        return "Fair"
    return "Needs attention"


def score_trips(store: TripStore) -> pd.DataFrame:
    """One row per scored trip: both scores, the baseline score, counts, and the reasons for each score.

    What is normal for a trip comes from a model trained without that trip's driver.
    """
    segs = training_segments(store)
    expected = held_out_expected(segs).add_prefix("expected_")
    segs = pd.concat([segs, expected], axis=1)
    segs["road"] = np.select([segs["highway_share"] >= 0.5, segs["main_road_share"] >= 0.5], ["highway", "main road"], "local street")

    trips = segs.groupby("trip_id").agg(
        driver=("driver", "first"), km=("driver", "size"),
        highway_share=("highway_share", "mean"), main_road_share=("main_road_share", "mean"),
        **{kind: (kind, "sum") for kind in EVENT_TYPES},
        **{f"expected_{kind}": (f"expected_{kind}", "sum") for kind in EVENT_TYPES},
    )
    trips["observed"] = trips[list(EVENT_TYPES)].sum(axis=1)
    trips["expected"] = trips[[f"expected_{kind}" for kind in EVENT_TYPES]].sum(axis=1)
    trips["ratio"] = (trips["observed"] + SMOOTHING) / (trips["expected"] + SMOOTHING)
    trips["expected_per_km"] = trips["expected"] / trips["km"]
    average_rate = segs[list(EVENT_TYPES)].sum(axis=1).mean()
    trips["driving_score"] = halving_score(trips["ratio"], 1.0).round(1)
    trips["conditions_score"] = halving_score(trips["expected_per_km"], average_rate).round(1)

    base = baseline.trip_scores(store).set_index("trip_id")
    trips["baseline_score"] = base["score"].reindex(trips.index)

    details = {trip_id: store.details(trip_id) for trip_id in trips.index}
    trips["start"] = [details[t]["start"] for t in trips.index]
    trips["is_dark"] = [details[t]["time"]["is_dark"] for t in trips.index]
    trips["style"] = [(details[t].get("labels") or {}).get("style") for t in trips.index]

    road_rates = segs.groupby("road")[list(EVENT_TYPES)].sum().sum(axis=1) / segs.groupby("road").size()
    trips["driving_reasons"] = [driving_reasons(row) for _, row in trips.iterrows()]
    trips["conditions_reasons"] = [conditions_reasons(row, details[t], road_rates, average_rate) for t, row in trips.iterrows()]
    return trips.reset_index()


def driving_reasons(row: pd.Series) -> list[str]:
    """Three reasons, worst first. A top-tier score says plainly that nothing needs to change."""
    excess = sorted(EVENT_TYPES, key=lambda kind: row[kind] - row[f"expected_{kind}"], reverse=True)
    reasons = []
    if row["driving_score"] >= TOP_TIER:
        reasons.append("Your driving needs no change: harsh moments were at or below what is normal for these roads and conditions.")
    for kind in excess:
        observed, normal = int(row[kind]), row[f"expected_{kind}"]
        did = f"You {VERBS[kind]} {_times(observed)}" if observed else f"You never {VERBS[kind]}"
        if observed > normal + 0.5:
            reasons.append(f"{did}. About {_about(normal)} is normal on these roads at this time.")
        else:
            reasons.append(f"{did}, which is normal or better for these roads at this time.")
    return reasons[:3]


def conditions_reasons(row: pd.Series, details: dict, road_rates: pd.Series, average_rate: float) -> list[str]:
    road = "highway" if row["highway_share"] >= 0.5 else "main road" if row["main_road_share"] >= 0.5 else "local street"
    share = {"highway": row["highway_share"], "main road": row["main_road_share"]}.get(road, 1 - row["highway_share"] - row["main_road_share"])
    time, weather = details["time"], details.get("weather")
    light = "in the dark" if time["is_dark"] else "in daylight"
    if weather is None:
        sky = "No weather record: weather is only available for trips in Canada." if details["source"] != "sensorlogger" else "Weather for this hour is not published yet."
    else:
        parts = [f"{weather['temp_c']:.0f} °C" if weather["temp_c"] is not None else None, weather["description"],
                 f"{weather['precip_mm']:.1f} mm of rain" if weather["precip_mm"] else None]
        sky = "Weather: " + ", ".join(p for p in parts if p) + "."
    return [
        f"Conditions like these usually bring {_per10(row['expected_per_km'])} harsh moments every 10 km. An average trip brings {_per10(average_rate)}.",
        f"{share:.0%} of this trip was on {ROAD_NAMES[road]}, where drivers here average {_per10(road_rates[road])} harsh moments every 10 km.",
        f"Driven {light}, {time['weekday']} around {time['local_hour']}:00. {sky}",
    ]


def _times(n: int) -> str:
    return {1: "once", 2: "twice"}.get(n, f"{n} times")


def _about(value: float) -> str:
    return "none" if value < 0.5 else str(round(value))


def _per10(per_km: float) -> str:
    value = per_km * 10
    return f"{value:.0f}" if value >= 10 else f"{value:.1f}"
