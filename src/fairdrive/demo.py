"""Demo data: insurance companies and drivers with trips on real London, Ontario roads.

Routes come from the public OSRM router, which follows OpenStreetMap roads. Each driver has a style
(calm, normal or aggressive) that sets how hard they brake, speed up and take corners. The motion
is worked out from each route's own speeds, curves and stops, so city streets bring more harsh
moments than highways, as in real driving. Trips are then tagged like uploaded ones: road type,
speed limit, time of day and Environment Canada weather.
"""

import json
import secrets
import string
import time
import urllib.request

import numpy as np
import pandas as pd

from fairdrive.accounts import Accounts
from fairdrive.companies import Companies
from fairdrive.geo import step_distances_m
from fairdrive.roads import USER_AGENT, fetch_roads
from fairdrive.store import TripStore
from fairdrive.tagging import tag_all
from fairdrive.trips import STEP, finish_trip

OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
# Homes and most destinations: the city of London. Some trips head to Highway 401/402 south of it.
CITY_BOX = (42.93, -81.36, 43.04, -81.14)  # south, west, north, east
HIGHWAY_BOX = (42.885, -81.38, 42.925, -81.10)
ROADS_BOX = (42.87, -81.42, 43.06, -81.06)  # every route stays inside this
HIGHWAY_TRIP_SHARE = 0.25
TRIP_KM = (4, 25)
FIRST_DAY, LAST_DAY = pd.Timestamp("2026-09-01", tz="America/Toronto"), pd.Timestamp("2026-11-20", tz="America/Toronto")

NEW_COMPANIES = ["Forest City Mutual", "Thames Valley Insurance", "Maple Shield Insurance", "Northbound Auto Insurance"]
MAIN_COMPANY = "TD Insurance"
MAIN_SHARE = 0.4
# Share of drivers, and typical limits in m/s²: speeding up, braking, sideways in corners. A harsh moment is
# 1.47 m/s² (0.15 g), so a normal driver crosses it on about a quarter of stops, starts and corners.
# "ease" is how gently they change speed for anything but a stop or a start (a bend, a lower speed limit).
STYLES = {
    "calm": {"share": 0.25, "accel": 0.8, "brake": 0.9, "corner": 0.9, "ease": 0.5, "pace": 0.95},
    "normal": {"share": 0.6, "accel": 1.1, "brake": 1.1, "corner": 1.15, "ease": 0.7, "pace": 1.0},
    "aggressive": {"share": 0.15, "accel": 1.9, "brake": 2.0, "corner": 1.7, "ease": 1.0, "pace": 1.08},
}
PHONES = [("iPhone 15", "iOS"), ("iPhone 14", "iOS"), ("iPhone 13", "iOS"), ("Pixel 8", "Android"),
          ("Galaxy S23", "Android"), ("Galaxy A54", "Android")]
FIRST_NAMES = ["Amara", "Liam", "Priya", "Noah", "Mei", "Ethan", "Fatima", "Lucas", "Chloe", "Mateo", "Aisha", "Owen",
               "Sofia", "Daniel", "Zara", "Jacob", "Leila", "Ryan", "Hana", "Marcus", "Ines", "Kwame", "Grace", "Arjun",
               "Olivia", "Tariq", "Emily", "Diego", "Nadia", "Samuel", "Yuki", "Isaac", "Maya", "Felix", "Ada", "Omar"]
LAST_NAMES = ["Okafor", "Tremblay", "Singh", "Chen", "MacDonald", "Nguyen", "Haddad", "Roy", "Patel", "Wilson", "Mensah",
              "Gagnon", "Kim", "Martin", "Adeyemi", "Brown", "Lopez", "Campbell", "Ali", "Fraser", "Bello", "Wong",
              "Murphy", "Osei", "Taylor", "Kowalski", "Reid", "Santos", "Ibrahim", "Young"]

GRID_M = 2.0
CURVE_WINDOW_M = 40
TURN_DEG = 60  # a heading change this big within TURN_WINDOW_M is a junction turn
TURN_WINDOW_M = 30
STOP_AT_TURN = 0.5
LIGHT_EVERY_M = 1200  # roughly one traffic light or stop sign this often on city roads
CITY_SPEED_MS = 22  # OSRM speeds below this are city roads (about 80 km/h)
NOISE_MS2 = 0.05


def seed(store: TripStore, staff: Accounts, drivers: Accounts, companies: Companies, n_drivers: int, trips_per_driver: int,
         rng: np.random.Generator) -> dict:
    """Adds the companies, drivers and trips, then tags the trips. Returns the logins it made."""
    city_ways = _city_roads()  # first: if OpenStreetMap doesn't answer, nothing has been added yet
    print(f"{len(city_ways)} London roads loaded")
    company_ids = _companies(staff, companies)
    password = _password()
    for n, company_id in enumerate(_assign(company_ids, n_drivers, companies)):
        driver_id, style = f"u{secrets.token_hex(4)}", rng.choice(list(STYLES), p=[s["share"] for s in STYLES.values()])
        first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        drivers.add(f"{first.lower()}.{last.lower()}{n + 1}@example.com", password, name=f"{first} {last}", driver_id=driver_id,
                    company_id=company_id)
        phone = dict(zip(("device", "platform"), PHONES[rng.integers(len(PHONES))]))
        for _ in range(trips_per_driver):
            trip = finish_trip(*_drive(_route(rng), STYLES[style], _start_time(rng), rng))
            if trip.flag is None and not store.exists(store.trip_id(driver_id, trip)):
                store.save(driver_id, trip, "sensorlogger", {"style": style}, phone)
        print(f"driver {n + 1}/{n_drivers} ({style})")
    print("Tagging road, time and weather…")
    tag_all(store, lambda lat, lon: _near(city_ways, lat, lon))
    return {"driver_password": password, "owners": company_ids["new_owners"]}


def _companies(staff: Accounts, companies: Companies) -> dict:
    """The approved companies' ids, after adding NEW_COMPANIES (each with an owner) if they aren't there."""
    owners = []
    for name in NEW_COMPANIES:
        if companies.name_taken(name):
            continue
        company_id, slug = f"c{secrets.token_hex(4)}", name.split()[0].lower()
        password = _password()
        staff.add(f"owner@{slug}.test", password, name=f"{name} owner", role="owner", company_id=company_id)
        companies.add(company_id, name)
        companies.set_status(company_id, "approved")
        owners.append({"company": name, "email": f"owner@{slug}.test", "password": password})
    approved = [c for c in companies.all() if c["status"] == "approved"]
    return {"ids": [c["company_id"] for c in approved], "new_owners": owners}


def _assign(company_ids: dict, n: int, companies: Companies) -> list[str]:
    """MAIN_SHARE of drivers to MAIN_COMPANY (if approved), the rest spread evenly over the others."""
    ids = company_ids["ids"]
    main = [i for i in ids if companies.get(i)["name"] == MAIN_COMPANY]
    others = [i for i in ids if i not in main]
    n_main = round(n * MAIN_SHARE) if main else 0
    return main * n_main + [others[k % len(others)] for k in range(n - n_main)]


def _password() -> str:
    return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))


# Routes and roads

def _city_roads() -> list[dict]:
    south, west, north, east = ROADS_BOX
    ways = fetch_roads(np.array([south, north]), np.array([west, east]))
    for way in ways:
        lats, lons = [p["lat"] for p in way["geometry"]], [p["lon"] for p in way["geometry"]]
        way["box"] = (min(lats), min(lons), max(lats), max(lons))
    return ways


def _near(ways: list[dict], lat: np.ndarray, lon: np.ndarray, pad: float = 0.001) -> list[dict]:
    """The ways whose bounding box overlaps the trip's: what fetch_roads would return for it."""
    s, w, n, e = lat.min() - pad, lon.min() - pad, lat.max() + pad, lon.max() + pad
    return [way for way in ways if way["box"][0] <= n and way["box"][2] >= s and way["box"][1] <= e and way["box"][3] >= w]


def _route(rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """(points as [[lat, lon]], OSRM's expected speed in m/s for each step between them) of a TRIP_KM-long drive."""
    while True:
        home = _point(CITY_BOX, rng)
        away = _point(HIGHWAY_BOX if rng.random() < HIGHWAY_TRIP_SHARE else CITY_BOX, rng)
        if rng.random() < 0.5:
            home, away = away, home
        url = f"{OSRM_URL}/{home[1]:.5f},{home[0]:.5f};{away[1]:.5f},{away[0]:.5f}?overview=full&geometries=geojson&annotations=speed"
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=60) as response:
            route = json.load(response)["routes"][0]
        time.sleep(0.5)  # the public router asks for at most about one request a second
        if TRIP_KM[0] * 1000 <= route["distance"] <= TRIP_KM[1] * 1000:
            points = np.array(route["geometry"]["coordinates"])[:, ::-1]
            speeds = np.concatenate([leg["annotation"]["speed"] for leg in route["legs"]])
            return points, speeds


def _point(box: tuple, rng: np.random.Generator) -> tuple[float, float]:
    south, west, north, east = box
    return rng.uniform(south, north), rng.uniform(west, east)


def _start_time(rng: np.random.Generator) -> pd.Timestamp:
    """A weekday or weekend start, mostly at commuting hours, between FIRST_DAY and LAST_DAY."""
    day = FIRST_DAY + pd.Timedelta(days=int(rng.integers((LAST_DAY - FIRST_DAY).days)))
    hour = rng.choice([7, 8, 9, 12, 15, 16, 17, 18, 19, 21, 22], p=[.1, .15, .08, .1, .07, .12, .15, .1, .06, .04, .03])
    return (day + pd.Timedelta(hours=int(hour), minutes=int(rng.integers(60)))).tz_convert("UTC")


# Motion

def _drive(route: tuple[np.ndarray, np.ndarray], style: dict, start: pd.Timestamp, rng: np.random.Generator):
    """(start, end, 10 Hz points) of one drive along route by a driver of this style."""
    points, step_speed = route
    lat, lon, s, cruise = _grid(points, step_speed)
    heading = _heading(lat, lon)
    # Map roads are straight pieces joined at corners, so a bend is measured over CURVE_WINDOW_M, not point by point.
    half, unwrapped = int(CURVE_WINDOW_M / GRID_M) // 2, np.unwrap(heading)
    ahead, behind = unwrapped[np.minimum(np.arange(len(s)) + half, len(s) - 1)], unwrapped[np.maximum(np.arange(len(s)) - half, 0)]
    curvature = (ahead - behind) / CURVE_WINDOW_M
    n = len(s)

    # How fast the driver would like to go: the road's usual speed, slower through corners.
    pace = style["pace"] * _wander(n, rng, 0.05, int(400 / GRID_M))
    corner = style["corner"] * _wander(n, rng, 0.2, int(150 / GRID_M))
    target = np.minimum(cruise * pace, np.sqrt(corner / np.maximum(np.abs(curvature), 1e-6)))

    # Stops: some junction turns, and lights or stop signs along city roads. Both ends of the trip.
    stops = np.zeros(n, dtype=bool)
    stops[[0, -1]] = True
    turn = np.abs(_turn_over(heading, int(TURN_WINDOW_M / GRID_M))) > np.radians(TURN_DEG)
    turn_starts = np.flatnonzero(turn & ~np.roll(turn, 1))
    stops[turn_starts[rng.random(len(turn_starts)) < STOP_AT_TURN]] = True
    city = cruise < CITY_SPEED_MS
    lights = np.flatnonzero(city & (rng.random(n) < GRID_M / LIGHT_EVERY_M))
    stops[lights] = True
    target[stops] = 0.0

    # Gentle changes of speed everywhere, except braking into a stop and pulling away from one: each of
    # those has its own firmness around the driver's usual one.
    accel, brake = np.full(n, style["ease"]), np.full(n, style["ease"])
    top = np.max(cruise)
    for k in np.flatnonzero(stops):
        firm_brake, firm_accel = (style[key] * np.exp(0.35 * rng.normal()) for key in ("brake", "accel"))
        brake[(s >= s[k] - top ** 2 / (2 * firm_brake) - 20) & (s <= s[k])] = firm_brake
        accel[(s >= s[k]) & (s <= s[k] + top ** 2 / (2 * firm_accel) + 20)] = firm_accel
    speed = target.copy()
    for i in range(1, n):  # can't speed up faster than accel allows
        speed[i] = min(speed[i], np.sqrt(speed[i - 1] ** 2 + 2 * accel[i] * GRID_M))
    for i in range(n - 2, -1, -1):  # must start braking early enough
        speed[i] = min(speed[i], np.sqrt(speed[i + 1] ** 2 + 2 * brake[i] * GRID_M))

    # Distance -> time. A stop waits 2 to 30 seconds before moving on.
    mean = np.maximum((speed[:-1] + speed[1:]) / 2, 0.3)
    t = np.concatenate([[0.0], np.cumsum(GRID_M / mean)])
    wait = np.where(stops, rng.uniform(2, 30, n), 0.0)
    wait[[0, -1]] = 0
    arrive = t + np.concatenate([[0.0], np.cumsum(wait)[:-1]])
    leave = arrive + wait
    times, where = np.ravel(np.column_stack([arrive, leave])), np.repeat(np.arange(n), 2)

    clock = np.arange(0, times[-1], STEP.total_seconds())
    i = np.interp(clock, times, where)
    v = np.interp(i, np.arange(n), speed)
    forward = _smooth(np.gradient(v, STEP.total_seconds()), 5)
    sideways = v ** 2 * np.interp(i, np.arange(n), curvature)
    index = start + pd.to_timedelta(clock, unit="s")
    frame = pd.DataFrame({
        "lat": np.interp(i, np.arange(n), lat), "lon": np.interp(i, np.arange(n), lon), "speed": v,
        "acc_forward": forward + rng.normal(0, NOISE_MS2, len(clock)),
        "acc_lateral": sideways + rng.normal(0, NOISE_MS2, len(clock)),
        "acc_vertical": rng.normal(0, 0.3, len(clock)),
    }, index=pd.DatetimeIndex(index).as_unit("ns"))
    return frame.index[0], frame.index[-1], frame


def _grid(points: np.ndarray, step_speed: np.ndarray):
    """The route every GRID_M metres: lat, lon, distance along it, and OSRM's speed there."""
    step = step_distances_m(points[:, 0], points[:, 1])
    distance = np.cumsum(step)
    keep = np.concatenate([[True], step[1:] > 0])  # drop repeated points
    distance, points = distance[keep], points[keep]
    s = np.arange(0, distance[-1], GRID_M)
    lat, lon = np.interp(s, distance, points[:, 0]), np.interp(s, distance, points[:, 1])
    step_index = np.clip(np.searchsorted(distance, s, side="right") - 1, 0, len(step_speed) - 1)
    cruise = np.clip(np.asarray(step_speed, dtype=float)[step_index], 5.0, 30.0)
    return lat, lon, s, _smooth(cruise, int(60 / GRID_M))


def _heading(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    north = np.gradient(lat) * 111_195.0
    east = np.gradient(lon) * 111_195.0 * np.cos(np.radians(lat))
    return np.arctan2(east, north)


def _turn_over(heading: np.ndarray, window: int) -> np.ndarray:
    unwrapped = np.unwrap(heading)
    ahead = np.concatenate([unwrapped[window:], np.full(window, unwrapped[-1])])
    return ahead - unwrapped


def _smooth(values: np.ndarray, window: int) -> np.ndarray:
    window = max(1, window)
    return pd.Series(values).rolling(window, center=True, min_periods=1).mean().to_numpy()


def _wander(n: int, rng: np.random.Generator, spread: float, window: int) -> np.ndarray:
    """A slowly changing multiplier around 1 (log-normal, about ±spread)."""
    noise = _smooth(rng.normal(0, 1, n), window) * np.sqrt(max(1, window))
    return np.exp(spread * np.clip(noise, -2.5, 2.5))
