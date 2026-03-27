from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.emailer import send_invite_email
from app.ics import build_ics_bytes, resolve_summary
from app.models import InviteRequest, normalize_emails, parse_utc_datetime

BASE_DIR = Path(__file__).resolve().parent
load_dotenv()

app = FastAPI(title="LinkInvite")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

SENDER_EMAIL = os.getenv("SENDER_EMAIL", "").strip()
APP_PASSWORD = os.getenv("APP_PASSWORD", "").strip()
SMTP_READY = bool(SENDER_EMAIL and APP_PASSWORD)

if not SMTP_READY:
    print(
        "LinkInvite warning: SMTP credentials missing. "
        "Send functionality will run in download-only mode."
    )


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"smtp_ready": SMTP_READY},
    )


@app.post("/invite.ics")
def create_invite(payload: InviteRequest) -> StreamingResponse:
    recipients = normalize_emails(payload.invitee_emails)
    has_recipients = len(recipients) > 0
    should_attempt_send = SMTP_READY and has_recipients

    start_utc = parse_utc_datetime(payload.start_time_utc)
    ics_bytes = build_ics_bytes(
        title=payload.title,
        your_name=payload.your_name,
        start_utc=start_utc,
        duration_hours=payload.duration_hours,
        location=payload.location,
        method_request=should_attempt_send,
    )

    summary = resolve_summary(payload.title, payload.your_name)
    subject = (payload.custom_subject or "").strip() or summary
    body = (payload.custom_body or "").strip() or (
        f"You are invited to {summary}.\n"
        f"Timezone captured from browser: {(payload.timezone or 'Unknown')}\n"
        "Please use the attached calendar invite."
    )
    # Normalize non-breaking spaces that often appear from copy/paste.
    subject = subject.replace("\u00a0", " ")
    body = body.replace("\u00a0", " ")

    mail_status = "not_attempted"
    mail_message = "Download complete."

    if has_recipients and not SMTP_READY:
        mail_status = "smtp_not_configured"
        mail_message = "SMTP credentials missing. Invite was downloaded only."
    elif should_attempt_send:
        try:
            send_invite_email(
                sender_email=SENDER_EMAIL,
                app_password=APP_PASSWORD,
                recipients=recipients,
                subject=subject,
                body=body,
                ics_bytes=ics_bytes,
            )
            mail_status = "sent"
            mail_message = "Invite email sent and file downloaded."
        except Exception as exc:
            mail_status = "failed"
            mail_message = (
                "Email send failed. Check Gmail app password/SMTP settings. "
                "Invite was downloaded."
            )
            print(f"LinkInvite warning: SMTP send failed: {exc}")
    elif not has_recipients:
        mail_status = "no_valid_recipients"
        mail_message = "No valid recipient email. Invite was downloaded only."

    headers = {
        "Content-Disposition": 'attachment; filename="linkinvite-invite.ics"',
        "X-LinkInvite-Mail-Status": mail_status,
        "X-LinkInvite-Mail-Message": mail_message,
    }
    return StreamingResponse(
        BytesIO(ics_bytes),
        media_type="text/calendar; charset=utf-8",
        headers=headers,
    )
