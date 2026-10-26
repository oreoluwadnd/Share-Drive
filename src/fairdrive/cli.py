import argparse
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd

from fairdrive.baseline import driver_scores
from fairdrive.compare import comparison
from fairdrive.model import train
from fairdrive.scoring import score_trips
from fairdrive.sensorlogger import MissingColumnError
from fairdrive.stability import stability
from fairdrive.store import TripStore
from fairdrive.tagging import tag_all
from fairdrive.uah import load_dataset
from fairdrive.upload import upload

APP = Path(__file__).with_name("app.py")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="fairdrive")
    parser.add_argument("--data-dir", type=Path, default=Path("data"), help="where trips are stored (default: data)")
    commands = parser.add_subparsers(dest="command", required=True)

    upload_cmd = commands.add_parser("upload", help="upload a Sensor Logger JSON export")
    upload_cmd.add_argument("file", type=Path)
    upload_cmd.add_argument("--driver", required=True)
    uah_cmd = commands.add_parser("load-uah", help="load the UAH-DriveSet public dataset")
    uah_cmd.add_argument("folder", type=Path, help="the UAH-DRIVESET-v1 folder")
    commands.add_parser("tag", help="add road type, speed limit, time of day and weather to trips (needs internet)")
    commands.add_parser("trips", help="list uploaded trips")
    commands.add_parser("summary", help="drivers, trips and kilometres per source")
    commands.add_parser("baseline", help="naive event-count score per driver")
    commands.add_parser("train", help="test the context model on held-out drivers, then save it")
    commands.add_parser("scores", help="FairDrive driving and conditions scores per trip")
    compare_cmd = commands.add_parser("compare", help="FairDrive vs baseline by driver group")
    compare_cmd.add_argument("--csv", type=Path, help="also save the table as CSV")
    commands.add_parser("stability", help="how much each driver's score varies across conditions")
    commands.add_parser("dashboard", help="open the dashboard in the browser")

    args = parser.parse_args(argv)
    store = TripStore(args.data_dir)
    pd.set_option("display.width", 200)

    if args.command == "upload":
        try:
            trip_ids = upload(args.file, args.driver, store)
        except MissingColumnError as error:
            sys.exit(f"error: {error}. Nothing was saved.")
        trips = store.list()
        print(trips[trips["trip_id"].isin(trip_ids)].to_string(index=False))
    elif args.command == "load-uah":
        print(f"Loaded {len(load_dataset(args.folder, store))} trips")
        print(store.summary().to_string(index=False))
    elif args.command == "tag":
        print(f"Tagged {len(tag_all(store))} trips")
    elif args.command == "summary":
        print(store.summary().to_string(index=False))
    elif args.command == "trips":
        print(store.list().to_string(index=False))
    elif args.command == "baseline":
        print(driver_scores(store).to_string(index=False))
    elif args.command == "train":
        e = train(store)
        print(f"Held out each of {e['drivers']} drivers in turn ({e['segments_km']} km).")
        print(f"Error (mean Poisson deviance): model {e['model_error']}, simple average {e['average_error']}.")
        print(f"The model is {e['improvement_pct']}% better than the simple average (target: at least 10%).")
    elif args.command == "scores":
        scores = score_trips(store)
        columns = ["trip_id", "km", "observed", "expected", "driving_score", "conditions_score", "baseline_score"]
        print(scores[columns].round(2).to_string(index=False))
    elif args.command == "compare":
        table = comparison(score_trips(store))
        print(table.to_string(index=False))
        if args.csv:
            table.to_csv(args.csv, index=False)
            print(f"Saved {args.csv}")
    elif args.command == "stability":
        result = stability(score_trips(store))
        print(result["per_group"].to_string(index=False))
        print(f"Average variance within a driver: FairDrive {result['fairdrive_variance']}, baseline {result['baseline_variance']}.")
        print(f"FairDrive varies {result['reduction_pct']}% less (target: at least 30%).")
    elif args.command == "dashboard":
        env = {**os.environ, "FAIRDRIVE_DATA": str(args.data_dir.resolve())}
        subprocess.run([sys.executable, "-m", "streamlit", "run", str(APP)], env=env, check=True)
