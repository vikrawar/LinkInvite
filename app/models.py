"""Request models and normalization helpers for LinkInvite."""

from __future__ import annotations
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, TypeAdapter

EMAIL_ADAPTER = TypeAdapter(EmailStr)


class InviteRequest(BaseModel):
    """Payload schema accepted by the invite generation endpoint."""

    title: str | None = None
    your_name: str | None = None
    start_time_utc: str = Field(..., description="UTC ISO datetime string")
    duration_hours: float = Field(..., gt=0)
    location: str | None = None
    invitee_emails: list[str] | None = None
    custom_subject: str | None = None
    custom_body: str | None = None
    timezone: str | None = None


def parse_utc_datetime(iso_value: str) -> datetime:
    """Parse an ISO timestamp and require timezone-aware input."""
    value = iso_value.strip()
    if value.endswith("Z"):
        value = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError("start_time_utc must include UTC timezone information")
    return parsed


def normalize_emails(values: list[str] | None) -> list[str]:
    """Return a cleaned list of syntactically valid email addresses."""
    if not values:
        return []
    normalized: list[str] = []
    for email in values:
        candidate = email.strip()
        if not candidate:
            continue
        try:
            parsed = EMAIL_ADAPTER.validate_python(candidate)
            normalized.append(str(parsed))
        except Exception:
            continue
    return normalized
