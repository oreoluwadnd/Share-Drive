"""FairDrive dashboard. Start it with `uv run fairdrive dashboard`."""

import json
import os
import tempfile
import urllib.error
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

from fairdrive.compare import comparison
from fairdrive.events import THRESHOLD_G, G, event_starts
from fairdrive.features import is_tagged
from fairdrive.model import model_dir, train
from fairdrive.scoring import conditions_tier, score_trips, tier
from fairdrive.sensorlogger import MissingColumnError
from fairdrive.stability import TARGET_REDUCTION_PCT, stability
from fairdrive.store import TripStore
from fairdrive.tagging import tag_all
from fairdrive.upload import upload

# Colour-blind-safe pair; every chart also labels its series in words.
BLUE, ORANGE, INK = "#2a78d6", "#c2410c", "#4a504b"

store = TripStore(Path(os.environ.get("FAIRDRIVE_DATA", "data")))
st.set_page_config(page_title="FairDrive", layout="wide")


def state_key() -> tuple:
    """Changes whenever a trip or the model changes, so cached scores are recomputed."""
    files = sorted(store.trips_dir.glob("*")) + sorted(model_dir(store).glob("*"))
    return tuple((f.name, f.stat().st_mtime_ns) for f in files)


@st.cache_data(show_spinner="Scoring trips…")
def load_scores(key: tuple) -> pd.DataFrame:
    return score_trips(store)


def scorable_drivers() -> int:
    trips = store.list()
    trips = trips[trips["flag"].isna()]
    return trips[[is_tagged(store.details(t)) for t in trips["trip_id"]]]["driver"].nunique()


# Sidebar: add a trip, tag it, retrain.
with st.sidebar:
    st.header("Add a trip")
    with st.form("upload", clear_on_submit=True):
        driver = st.text_input("Driver name", key="driver_name")
        recording = st.file_uploader("Sensor Logger recording (JSON)", type=["json"], key="recording")
        submitted = st.form_submit_button("Upload")
    if submitted:
        if not driver or recording is None:
            st.error("Enter a driver name and choose a recording.")
        else:
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / recording.name
                path.write_bytes(recording.getvalue())
                try:
                    trip_ids = upload(path, driver.strip(), store)
                    st.success(f"Saved {len(trip_ids)} trip(s). Next: add road, time and weather.")
                except MissingColumnError as error:
                    st.error(f"{error}. Nothing was saved.")
                except FileExistsError as error:
                    st.error(str(error))

    if st.button("Add road, time and weather", help="Looks up OpenStreetMap and Environment Canada. Needs internet."):
        with st.spinner("Looking up roads and weather…"):
            try:
                st.success(f"Tagged {len(tag_all(store))} trip(s).")
            except urllib.error.HTTPError as error:
                st.error(f"The map or weather server answered {error.code}. It is often busy: try again in a minute. Finished trips are kept.")

    st.header("Model")
    if st.button("Test the model", help="Predicts each driver's trips with a model that never saw that driver."):
        with st.spinner("Testing on held-out drivers…"):
            train(store)
    evaluation_file = model_dir(store) / "evaluation.json"
    if evaluation_file.exists():
        e = json.loads(evaluation_file.read_text())
        st.caption(f"On drivers it never saw, it is {e['improvement_pct']}% more accurate than a simple average "
                   f"({e['drivers']} drivers, {e['segments_km']} km).")


st.title("FairDrive")
st.caption("Driving scores that judge you against what is normal for your roads, time and weather.")

if scorable_drivers() < 2:
    st.info("FairDrive needs tagged trips from at least 2 drivers. Upload trips, then press **Add road, time and weather**.")
    st.stop()

scores = load_scores(state_key())
scores["date"] = pd.to_datetime(scores["start"], format="ISO8601").dt.strftime("%Y-%m-%d %H:%M")
trips_tab, detail_tab, compare_tab, stability_tab = st.tabs(["My trips", "Trip details", "FairDrive vs old score", "Score stability"])


with trips_tab:
    drivers = sorted(scores["driver"].unique())
    chosen = st.selectbox("Driver", ["All drivers", *drivers], key="driver_filter")
    mine = scores if chosen == "All drivers" else scores[scores["driver"] == chosen]
    table = pd.DataFrame({
        "Date (UTC)": mine["date"], "Driver": mine["driver"], "Distance (km)": mine["km"],
        "Driving score": mine["driving_score"], "Driving": mine["driving_score"].map(tier),
        "Conditions score": mine["conditions_score"], "Old score": mine["baseline_score"],
    }).sort_values("Date (UTC)", ascending=False)
    st.dataframe(table, hide_index=True, width="stretch", column_config={
        "Driving score": st.column_config.ProgressColumn(min_value=0, max_value=100, format="%.0f"),
        "Conditions score": st.column_config.NumberColumn(format="%.0f", help="100 = easiest roads, time and weather"),
        "Old score": st.column_config.NumberColumn(format="%.0f", help="Harsh moments per km only, ignoring conditions"),
    })
    if chosen != "All drivers" and len(mine) > 1:
        st.subheader("Driving score over time")
        trend = mine.assign(when=pd.to_datetime(mine["start"], format="ISO8601")).sort_values("when")
        line = alt.Chart(trend).mark_line(point=alt.OverlayMarkDef(size=60), color=BLUE).encode(
            x=alt.X("when:T", title="Trip date"), y=alt.Y("driving_score:Q", title="Driving score", scale=alt.Scale(domain=[0, 100])),
            tooltip=[alt.Tooltip("date:N", title="Date"), alt.Tooltip("driving_score:Q", title="Driving score", format=".0f")])
        st.altair_chart(line, width="stretch")
    waiting = store.list()
    waiting = waiting[~waiting["trip_id"].isin(scores["trip_id"])]
    if len(waiting):
        with st.expander(f"{len(waiting)} trip(s) not scored"):
            reasons = waiting["flag"].fillna("Needs road, time and weather: press Add road, time and weather.")
            st.dataframe(pd.DataFrame({"Trip": waiting["trip_id"], "Why": reasons}), hide_index=True, width="stretch")


with detail_tab:
    labels = {row.trip_id: f"{row.date} · {row.driver} · {row.km:.0f} km" for row in scores.sort_values("start", ascending=False).itertuples()}
    trip_id = st.selectbox("Trip", list(labels), format_func=labels.get, key="trip_choice")
    row = scores.set_index("trip_id").loc[trip_id]
    left, right = st.columns(2)
    with left:
        st.metric("Driving score (yours to control)", f"{row['driving_score']:.0f} / 100")
        st.markdown(f"**{tier(row['driving_score'])}**")
        for reason in row["driving_reasons"]:
            st.markdown(f"- {reason}")
    with right:
        st.metric("Conditions score (100 = easiest)", f"{row['conditions_score']:.0f} / 100")
        st.markdown(f"**{conditions_tier(row['conditions_score'])}**")
        for reason in row["conditions_reasons"]:
            st.markdown(f"- {reason}")
    st.caption(f"Old score, which ignores conditions: {row['baseline_score']:.0f} / 100.")

    points = store.points(trip_id)
    st.subheader("Route")
    st.map(points[["lat", "lon"]].iloc[::20], size=8)

    minutes = (points.index - points.index[0]).total_seconds() / 60
    per_second = pd.DataFrame({"minute": minutes, "speed": points["speed"] * 3.6, "limit": points["speed_limit_kmh"],
                               "braking": points["acc_forward"] / G}, index=points.index).resample("1s").agg(
        {"minute": "first", "speed": "mean", "limit": "first", "braking": "min"}).dropna(subset=["minute"])
    st.subheader("Speed and speed limit")
    speed_long = per_second.melt("minute", ["speed", "limit"], var_name="series", value_name="kmh").replace(
        {"series": {"speed": "Speed", "limit": "Speed limit"}})
    st.altair_chart(alt.Chart(speed_long).mark_line().encode(
        x=alt.X("minute:Q", title="Minutes into trip"), y=alt.Y("kmh:Q", title="km/h"),
        color=alt.Color("series:N", title=None, scale=alt.Scale(domain=["Speed", "Speed limit"], range=[BLUE, INK])),
        strokeDash=alt.StrokeDash("series:N", title=None, scale=alt.Scale(domain=["Speed", "Speed limit"], range=[[1, 0], [5, 4]])),
        tooltip=["series:N", alt.Tooltip("kmh:Q", format=".0f"), alt.Tooltip("minute:Q", format=".1f")]), width="stretch")

    st.subheader("Braking and hard stops")
    brakes = event_starts(points)["hard_brake"]
    marks = pd.DataFrame({"minute": (brakes - points.index[0]).total_seconds() / 60, "label": "Hard brake"})
    braking = alt.Chart(per_second).mark_line(color=ORANGE).encode(
        x=alt.X("minute:Q", title="Minutes into trip"), y=alt.Y("braking:Q", title="Forward push (g), negative = braking"))
    limit = alt.Chart(pd.DataFrame({"y": [-THRESHOLD_G]})).mark_rule(strokeDash=[5, 4], color=INK).encode(y="y:Q")
    events = alt.Chart(marks).mark_point(shape="triangle-down", size=90, filled=True, color=INK).encode(
        x="minute:Q", y=alt.datum(-THRESHOLD_G - 0.05), tooltip=["label:N", alt.Tooltip("minute:Q", format=".1f")])
    st.altair_chart(braking + limit + events, width="stretch")
    st.caption(f"Dashed line: hard-brake limit ({THRESHOLD_G} g). Triangles: {len(brakes)} hard brake(s).")


with compare_tab:
    st.write("Both scores use the same scale: 50 means a normal number of harsh moments, 100 means none. "
             "The old score compares you with the average trip. FairDrive compares you with the average trip "
             "on the same roads, at the same time, in the same weather.")
    groups = comparison(scores)
    shown = groups.rename(columns={"group": "Group", "trips": "Trips", "drivers": "Drivers", "baseline_score": "Old score",
                                   "fairdrive_score": "FairDrive score", "difference": "Difference"})
    st.dataframe(shown, hide_index=True, width="stretch")
    long = groups[groups["trips"] > 0].melt("group", ["baseline_score", "fairdrive_score"], var_name="score", value_name="value").replace(
        {"score": {"baseline_score": "Old score", "fairdrive_score": "FairDrive score"}})
    bars = alt.Chart(long).mark_bar().encode(
        y=alt.Y("group:N", title=None, sort=list(groups["group"]), axis=alt.Axis(labelLimit=220)), x=alt.X("value:Q", title="Average score", scale=alt.Scale(domain=[0, 100])),
        yOffset="score:N", color=alt.Color("score:N", title=None, scale=alt.Scale(domain=["Old score", "FairDrive score"], range=[ORANGE, BLUE])),
        tooltip=["group:N", "score:N", alt.Tooltip("value:Q", format=".1f")])
    labels_layer = bars.mark_text(align="left", dx=4).encode(text=alt.Text("value:Q", format=".0f"), color=alt.value("#141614"))
    st.altair_chart(bars + labels_layer, width="stretch")
    st.download_button("Download as CSV", groups.to_csv(index=False), "fairdrive_vs_old_score.csv", "text/csv")


with stability_tab:
    result = stability(scores)
    st.write("The same driver driving the same way should get the same score on any road. "
             "Lower variation between their trips means the score measures the driving, not the conditions.")
    a, b, c = st.columns(3)
    a.metric("FairDrive variation", f"{result['fairdrive_variance']:.0f}")
    b.metric("Old score variation", f"{result['baseline_variance']:.0f}")
    c.metric("FairDrive varies less by", f"{result['reduction_pct']:.0f}%")
    c.markdown(f"Target {TARGET_REDUCTION_PCT:.0f}%: **{'met' if result['meets_target'] else 'not met'}**")
    st.dataframe(result["per_group"].rename(columns={
        "driver": "Driver", "style": "Driving style", "trips": "Trips",
        "fairdrive_variance": "FairDrive variation", "baseline_variance": "Old score variation"}), hide_index=True, width="stretch")
    st.caption("Variation is the variance of a driver's trip scores (0 to 100 scale), averaged over drivers.")
