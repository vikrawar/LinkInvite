# LinkInvite

A FastAPI + vanilla HTML/JS app that generates an RFC 5545 `.ics` calendar invite. It **always** returns a downloadable `.ics`, and **optionally** emails it to invitees via Gmail SMTP (STARTTLS) when configured.

## What it does

- **Creates** a `.ics` with `DTSTART/DTEND` in UTC, `UID`, `SUMMARY`, optional `LOCATION`
- **Downloads** the `.ics` to the sender every time
- **Optionally sends** the same invite as an email attachment (Gmail SMTP on port 587 + STARTTLS)
- **Degrades gracefully**: missing/invalid SMTP credentials never break downloads; the UI shows a persistent banner explaining what happened

## Local setup

### Requirements

- Python (3.10+ recommended)

### Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Environment variables (`.env`)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set the following:

- `**SENDER_EMAIL**`: the Gmail address you’re sending from
- `**APP_PASSWORD**`: a Gmail **App Password** (can be created here: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). Make sure 2-Step Verification is turned on first)

If you don’t set these, the app runs in **download-only mode**.

## Run

```bash
uvicorn app.main:app --reload
```

Then open `http://127.0.0.1:8000`.

## Endpoints (minimal)

- `**GET /**`: single-page form UI
- `**POST /invite.ics**`: accepts JSON event details and streams back a downloadable `.ics`
  - Response includes headers `X-LinkInvite-Mail-Status` / `X-LinkInvite-Mail-Message` so the frontend can display send vs download-only outcomes

