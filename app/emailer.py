"""Email delivery helpers for calendar invites."""

from __future__ import annotations

import smtplib
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def send_invite_email(
    *,
    sender_email: str,
    app_password: str,
    recipients: list[str],
    subject: str,
    body: str,
    ics_bytes: bytes,
) -> None:
    """Send an invite email with an ICS attachment using Gmail SMTP."""
    message = MIMEMultipart("mixed")
    message["From"] = sender_email
    message["To"] = ", ".join(recipients)
    # Ensure non-ASCII subjects (incl. NBSP) are encoded safely.
    message["Subject"] = str(Header(subject, "utf-8"))

    message.attach(MIMEText(body, "plain", "utf-8"))

    calendar_part = MIMEText(ics_bytes.decode("utf-8"), "calendar", "utf-8")
    calendar_part.replace_header(
        "Content-Type", "text/calendar; method=REQUEST; charset=UTF-8"
    )
    calendar_part.add_header("Content-Disposition", 'attachment; filename="invite.ics"')
    message.attach(calendar_part)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(sender_email, app_password)
        # Send bytes to avoid implicit ASCII encoding in smtplib.
        server.sendmail(sender_email, recipients, message.as_bytes())
