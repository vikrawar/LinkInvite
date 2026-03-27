"""ICS calendar construction utilities."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from icalendar import Calendar, Event


def resolve_summary(title: str | None, your_name: str | None) -> str:
    """Resolve event title using explicit title, then name-based fallback."""
    trimmed_title = (title or "").strip()
    if trimmed_title:
        return trimmed_title

    trimmed_name = (your_name or "").strip()
    if trimmed_name:
        return f"Hangout with {trimmed_name}"
    return "Hangout"


def build_ics_bytes(
    *,
    title: str | None,
    your_name: str | None,
    start_utc: datetime,
    duration_hours: float,
    location: str | None,
    method_request: bool,
) -> bytes:
    """Build and serialize a single-event ICS calendar document."""
    dtstart = start_utc.astimezone(timezone.utc)
    dtend = dtstart + timedelta(hours=duration_hours)

    calendar = Calendar()
    calendar.add("prodid", "-//LinkInvite//Hangout Inviter//EN")
    calendar.add("version", "2.0")
    if method_request:
        calendar.add("method", "REQUEST")

    event = Event()
    event.add("uid", f"{uuid4()}@linkinvite.local")
    event.add("summary", resolve_summary(title, your_name))
    event.add("dtstart", dtstart)
    event.add("dtend", dtend)
    event.add("dtstamp", datetime.now(timezone.utc))

    trimmed_location = (location or "").strip()
    if trimmed_location:
        event.add("location", trimmed_location)

    if method_request:
        event.add("status", "CONFIRMED")

    calendar.add_component(event)
    return calendar.to_ical()
