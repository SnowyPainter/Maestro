"""Utilities for expanding schedule batch requests into concrete instances."""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from typing import Dict, List
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .schemas import (
    MailScheduleBatchRequest,
    MailScheduleBlackout,
    MailScheduleDistribution,
    MailSchedulePlanInstance,
    MailScheduleSegment,
)

WEEKDAY_ALIASES: Dict[str, int] = {
    "MON": 0,
    "MONDAY": 0,
    "TUE": 1,
    "TUES": 1,
    "TUESDAY": 1,
    "WED": 2,
    "WEDNESDAY": 2,
    "THU": 3,
    "THUR": 3,
    "THURSDAY": 3,
    "FRI": 4,
    "FRIDAY": 4,
    "SAT": 5,
    "SATURDAY": 5,
    "SUN": 6,
    "SUNDAY": 6,
}


def normalize_due_at(dt: datetime) -> datetime:
    """Return a UTC-normalized timestamp clamped to minute precision."""

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    dt = dt.replace(second=0, microsecond=0)
    return dt.replace(tzinfo=None)


def _weekmask_indices(weekmask: List[str]) -> set[int]:
    if not weekmask:
        return set(range(7))
    indices: set[int] = set()
    for alias in weekmask:
        normalized = alias.strip().upper()
        idx = WEEKDAY_ALIASES.get(normalized)
        if idx is None:
            idx = WEEKDAY_ALIASES.get(normalized[:3])
        if idx is None:
            raise ValueError(f"invalid weekday alias: {alias}")
        indices.add(idx)
    return indices


def _seconds_to_time(total_seconds: float) -> time:
    clamped = max(0, int(round(total_seconds)))
    hours, remainder = divmod(clamped, 3600)
    hours = min(hours, 23)
    minutes, seconds = divmod(remainder, 60)
    return time(hour=hours, minute=minutes, second=seconds)


def _evenly_distribute_times(start: time, end: time, count: int) -> List[time]:
    if count <= 0:
        return []
    start_seconds = start.hour * 3600 + start.minute * 60 + start.second
    end_seconds = end.hour * 3600 + end.minute * 60 + end.second
    window = end_seconds - start_seconds
    if window <= 0:
        raise ValueError("segment window must be positive")
    if count == 1:
        midpoint = start_seconds + window / 2
        return [_seconds_to_time(midpoint)]
    step = window / (count - 1)
    return [_seconds_to_time(start_seconds + step * index) for index in range(count)]


def _generate_segment_times(
    segment: MailScheduleSegment,
    distribution: MailScheduleDistribution,
) -> List[time]:
    count = max(segment.count_per_day, 0)
    if count == 0:
        return []
    mode = (distribution.mode or "even").lower()
    if mode == "fixed":
        fixed = distribution.fixed_times.get(segment.id, [])
        if len(fixed) < count:
            raise ValueError(
                f"segment '{segment.id}' requires {count} fixed_times entries"
            )
        return fixed[:count]
    if mode == "even":
        return _evenly_distribute_times(segment.start, segment.end, count)
    raise ValueError(f"distribution mode '{distribution.mode}' is not supported")


def _time_in_blackout(candidate: time, blackouts: List[MailScheduleBlackout]) -> bool:
    for blackout in blackouts:
        if blackout.start <= candidate < blackout.end:
            return True
    return False


def plan_mail_schedule_instances(
    batch: MailScheduleBatchRequest,
) -> List[MailSchedulePlanInstance]:
    """Expand a batch request into concrete schedule timestamps."""

    try:
        tz = ZoneInfo(batch.timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"unknown timezone '{batch.timezone}'") from exc

    exdates = {d.isoformat() for d in batch.exdates}
    allowed_weekdays = _weekmask_indices(batch.weekmask)
    blackouts = batch.constraints.blackouts
    aggregated: List[tuple[datetime, datetime, str]] = []

    current = batch.date_range.start
    while current <= batch.date_range.end:
        if current.weekday() not in allowed_weekdays or current.isoformat() in exdates:
            current += timedelta(days=1)
            continue

        daily_candidates: List[tuple[datetime, datetime, str]] = []
        for segment in batch.segments:
            segment_times = _generate_segment_times(segment, batch.distribution)
            for segment_time in segment_times:
                if _time_in_blackout(segment_time, blackouts):
                    continue
                local_dt = datetime.combine(current, segment_time, tzinfo=tz)
                utc_dt = local_dt.astimezone(timezone.utc)
                daily_candidates.append((utc_dt, local_dt, segment.id))

        daily_candidates.sort(key=lambda item: item[0])

        min_gap = batch.constraints.min_gap_minutes
        gap_delta = timedelta(minutes=min_gap) if min_gap else timedelta(0)
        filtered: List[tuple[datetime, datetime, str]] = []
        for candidate in daily_candidates:
            if not filtered:
                filtered.append(candidate)
                continue
            delta = candidate[0] - filtered[-1][0]
            if gap_delta and delta < gap_delta:
                continue
            if batch.constraints.max_parallel == 1:
                same_minute = (
                    candidate[0].replace(second=0, microsecond=0)
                    == filtered[-1][0].replace(second=0, microsecond=0)
                )
                if same_minute:
                    continue
            filtered.append(candidate)

        max_per_day = batch.constraints.max_per_day
        if max_per_day is not None:
            filtered = filtered[:max_per_day]

        aggregated.extend(filtered)

        current += timedelta(days=1)

    aggregated.sort(key=lambda item: item[0])
    return [
        MailSchedulePlanInstance(
            due_at_utc=normalize_due_at(candidate[0]),
            local_due_at=candidate[1],
            segment_id=candidate[2],
            schedule_index=index,
        )
        for index, candidate in enumerate(aggregated)
    ]


__all__ = ["plan_mail_schedule_instances", "normalize_due_at"]
