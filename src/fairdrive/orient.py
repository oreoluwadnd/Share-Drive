"""Turn phone-frame acceleration into the car's forward, sideways and vertical directions."""

import numpy as np
import pandas as pd

# Below this speed GPS heading is too noisy to tell left turns from right turns.
MIN_TURN_SPEED_MS = 3.0


def to_car_frame(timeline: pd.DataFrame) -> pd.DataFrame:
    """Return acc_forward (+ = speeding up), acc_lateral (+ = pushed right) and acc_vertical (+ = up).

    Assumes the phone stays in one mount position for the whole trip.
    iOS and Android report acceleration and gravity with opposite signs. Each
    axis below is fitted against GPS, so the result is the same on both.
    """
    acc = timeline[["ax", "ay", "az"]].to_numpy()
    gravity_axis = timeline[["gx", "gy", "gz"]].mean().to_numpy()
    gravity_axis = gravity_axis / np.linalg.norm(gravity_axis)

    # Acceleration and gravity flip sign together between platforms, so this
    # projection is upward acceleration on both.
    vertical = acc @ gravity_axis
    horizontal = acc - np.outer(vertical, gravity_axis)

    seconds = (timeline.index - timeline.index[0]).total_seconds().to_numpy()
    speed = timeline["speed"].to_numpy()

    # Forward is the horizontal direction that best matches the change in GPS speed.
    speed_change = np.gradient(speed, seconds)
    fit, *_ = np.linalg.lstsq(horizontal, speed_change, rcond=None)
    forward_axis = fit - (fit @ gravity_axis) * gravity_axis
    forward_axis = forward_axis / np.linalg.norm(forward_axis)

    # Sideways is perpendicular to both. Its sign is set so right turns
    # (heading increasing clockwise) give positive values.
    lateral = acc @ np.cross(gravity_axis, forward_axis)
    turn_acc = speed * np.gradient(timeline["heading"].to_numpy(), seconds)
    fast = speed > MIN_TURN_SPEED_MS
    if np.sum(lateral[fast] * turn_acc[fast]) < 0:
        lateral = -lateral

    return pd.DataFrame(
        {"acc_forward": acc @ forward_axis, "acc_lateral": lateral, "acc_vertical": vertical},
        index=timeline.index,
    )
