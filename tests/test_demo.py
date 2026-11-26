"""Demo seed: the driving it makes looks like driving, and drivers land in the right companies. No network."""

import numpy as np
import pandas as pd

from fairdrive import demo
from fairdrive.accounts import Accounts
from fairdrive.companies import Companies
from fairdrive.events import count_events
from fairdrive.geo import step_distances_m
from fairdrive.trips import finish_trip

START = pd.Timestamp("2026-10-01 12:00", tz="UTC")


def corner_route() -> tuple[np.ndarray, np.ndarray]:
    """3 km east, a right-angle turn, then 3 km north, at about 50 km/h, with a point every 50 m."""
    east = np.column_stack([np.full(61, 42.98), -81.30 + np.arange(61) * 50 / (111_195 * np.cos(np.radians(42.98)))])
    north = np.column_stack([42.98 + np.arange(1, 61) * 50 / 111_195, np.full(60, east[-1, 1])])
    points = np.vstack([east, north])
    return points, np.full(len(points) - 1, 13.9)


def harsh_per_km(style: str, seeds=range(6)) -> float:
    total = km = 0.0
    for seed in seeds:
        start, end, points = demo._drive(corner_route(), demo.STYLES[style], START, np.random.default_rng(seed))
        total += sum(count_events(points).values())
        km += step_distances_m(points["lat"].to_numpy(), points["lon"].to_numpy()).sum() / 1000
    return total / km


def test_a_drive_is_a_scorable_10_hz_trip():
    start, end, points = demo._drive(corner_route(), demo.STYLES["normal"], START, np.random.default_rng(0))
    assert (points.index.to_series().diff().dropna() == pd.Timedelta("100ms")).all()
    assert points["speed"].iloc[0] < 1 and points["speed"].iloc[-1] < 1 and points["speed"].max() < 16
    km = step_distances_m(points["lat"].to_numpy(), points["lon"].to_numpy()).sum() / 1000
    assert 5.8 < km < 6.2
    assert 20 < km / ((end - start).total_seconds() / 3600) < 55  # km/h, stops included
    assert finish_trip(start, end, points).flag is None


def test_aggressive_drivers_have_more_harsh_moments_than_calm_ones():
    calm, normal, aggressive = (harsh_per_km(style) for style in ("calm", "normal", "aggressive"))
    assert calm < normal < aggressive
    assert calm < 0.6 and aggressive > 1.0


def test_the_turn_brings_sideways_force_and_straights_dont():
    start, end, points = demo._drive(corner_route(), demo.STYLES["normal"], START, np.random.default_rng(0))
    sideways = points["acc_lateral"].abs()
    corner = corner_route()[0][60]
    metres_from_corner = np.hypot((points["lat"] - corner[0]) * 111_195, (points["lon"] - corner[1]) * 111_195 * np.cos(np.radians(corner[0])))
    assert sideways[metres_from_corner < 50].max() > 0.5
    assert sideways[metres_from_corner > 100].max() < 0.5


def test_near_keeps_only_roads_around_the_trip():
    ways = [{"box": (42.97, -81.31, 42.99, -81.29)}, {"box": (43.10, -81.00, 43.11, -80.99)}]
    assert demo._near(ways, np.array([42.98, 42.985]), np.array([-81.30, -81.295])) == ways[:1]


def test_drivers_are_spread_over_companies_with_the_main_one_largest(tmp_path):
    staff, companies = Accounts(tmp_path / "staff.json"), Companies(tmp_path / "companies.json")
    companies.add("c-td", demo.MAIN_COMPANY)
    companies.set_status("c-td", "approved")
    made = demo._companies(staff, companies)
    assert len(made["ids"]) == 1 + len(demo.NEW_COMPANIES) and len(made["new_owners"]) == len(demo.NEW_COMPANIES)
    owner = made["new_owners"][0]
    assert staff.check(owner["email"], owner["password"])["role"] == "owner"
    assigned = pd.Series(demo._assign(made, 150, companies)).value_counts()
    assert assigned["c-td"] == 60 and assigned.drop("c-td").between(22, 23).all()
    assert demo._companies(staff, companies)["new_owners"] == []  # running again adds no companies
