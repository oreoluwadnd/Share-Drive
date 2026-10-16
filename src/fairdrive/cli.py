import argparse
import sys
from pathlib import Path

import pandas as pd

from fairdrive.baseline import driver_scores
from fairdrive.sensorlogger import MissingColumnError
from fairdrive.store import TripStore
from fairdrive.tagging import tag_all
from fairdrive.uah import load_dataset
from fairdrive.upload import upload


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
