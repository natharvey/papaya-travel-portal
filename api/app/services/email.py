import smtplib
import logging
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS", "")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
PORTAL_URL = os.getenv("PORTAL_URL", "http://localhost:5173")

BRAND_ORANGE = "#F07332"
BRAND_DARK = "#2D4A5A"
BRAND_MUTED = "#7A9099"


def _base_html(title: str, body_html: str) -> str:
    """Shared email shell — consistent header, footer, and typography across all emails."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EE;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #EAE0D0;">

        <!-- Header -->
        <tr>
          <td style="background:{BRAND_ORANGE};padding:24px 32px;">
            <span style="font-size:20px;font-weight:700;color:white;letter-spacing:-0.3px;">Travel Papaya</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;color:{BRAND_DARK};font-size:15px;line-height:1.6;">
            {body_html}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #EAE0D0;background:#FAF6EE;">
            <p style="margin:0;font-size:12px;color:{BRAND_MUTED};">© Travel Papaya · AI-powered travel planning</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _primary_button(url: str, label: str) -> str:
    return f"""<p style="margin:24px 0 0;">
    <a href="{url}" style="background:{BRAND_ORANGE};color:white;padding:13px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:15px;">{label}</a>
  </p>"""


def _secondary_button(url: str, label: str) -> str:
    return f"""<p style="margin:24px 0 0;">
    <a href="{url}" style="background:{BRAND_DARK};color:white;padding:13px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:15px;">{label}</a>
  </p>"""


def _send(to: str, subject: str, html: str, plain: str) -> None:
    """Send an email via Gmail SMTP. Logs and swallows errors so callers never crash."""
    if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
        logger.warning("Email not configured — skipping send to %s", to)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Travel Papaya <{EMAIL_ADDRESS}>"
    msg["To"] = to
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, to, msg.as_string())
        logger.info("Email sent to %s: %s", to, subject)
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)


def send_magic_link_email(to: str, client_name: str, magic_link: str) -> None:
    subject = "Your Travel Papaya login link"

    plain = f"""Hi {client_name},

Here is your one-click login link for the Travel Papaya portal:

{magic_link}

This link expires in 1 hour and can only be used once.

If you didn't request this, you can safely ignore this email.

Travel Papaya
"""

    body = f"""<p>Hi {client_name},</p>
  <p>Click below to log in to your Travel Papaya portal.</p>
  {_primary_button(magic_link, "Log in to your portal")}
  <p style="margin-top:16px;font-size:13px;color:{BRAND_MUTED};">This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email.</p>"""

    _send(to, subject, _base_html(subject, body), plain)


def send_intake_confirmation(
    to: str,
    client_name: str,
    reference_code: str,
    trip_title: str,
    magic_link: Optional[str] = None,
) -> None:
    subject = "We've received your trip request"

    login_url = magic_link or f"{PORTAL_URL}/login"
    button_label = "View your portal" if magic_link else "Log in to your portal"
    expiry_note = f'<p style="margin-top:8px;font-size:13px;color:{BRAND_MUTED};">This link expires in 1 hour. To log in later, visit <a href="{PORTAL_URL}/login" style="color:{BRAND_ORANGE};">{PORTAL_URL}/login</a>.</p>' if magic_link else ""

    plain = f"""Hi {client_name},

Thanks for submitting your trip request — we've got it.

Maya is now building your personalised itinerary for "{trip_title}". You'll receive another email as soon as it's ready to review, usually within a few minutes.

Log in to your portal to track progress:
{login_url}

Travel Papaya
"""

    body = f"""<p>Hi {client_name},</p>
  <p>Thanks for submitting your trip request — we've got it.</p>
  <p>Maya is now building your personalised itinerary for <strong>{trip_title}</strong>. You'll receive another email as soon as it's ready to review, usually within a few minutes.</p>
  {_primary_button(login_url, button_label)}
  {expiry_note}"""

    _send(to, subject, _base_html(subject, body), plain)


def send_itinerary_for_review(
    to: str,
    client_name: str,
    trip_title: str,
    trip_id: str,
) -> None:
    subject = f"Your itinerary is ready — {trip_title}"
    trip_url = f"{PORTAL_URL}/portal/trips/{trip_id}"

    plain = f"""Hi {client_name},

Your personalised itinerary for "{trip_title}" is ready.

Log in to your portal to view the full day-by-day plan. If you'd like any changes, you can chat with Maya directly from within the portal — she'll update your itinerary in real time.

{trip_url}

Travel Papaya
"""

    body = f"""<p>Hi {client_name},</p>
  <p>Your personalised itinerary for <strong>{trip_title}</strong> is ready to review.</p>
  <p>If you'd like any changes, you can chat with Maya directly from within the portal — she'll update your itinerary in real time.</p>
  {_primary_button(trip_url, "Review your itinerary")}"""

    _send(to, subject, _base_html(subject, body), plain)


def send_trip_confirmed_client(
    to: str,
    client_name: str,
    trip_title: str,
    trip_id: str,
) -> None:
    subject = f"Trip confirmed — {trip_title}"
    trip_url = f"{PORTAL_URL}/portal/trips/{trip_id}"

    plain = f"""Hi {client_name},

Your trip "{trip_title}" is confirmed. You can view your full itinerary and documents in your portal at any time.

{trip_url}

Travel Papaya
"""

    body = f"""<p>Hi {client_name},</p>
  <p>Your trip <strong>{trip_title}</strong> is confirmed.</p>
  <p>You can view your full itinerary and documents in your portal at any time.</p>
  {_primary_button(trip_url, "View your confirmed trip")}"""

    _send(to, subject, _base_html(subject, body), plain)


def send_trip_confirmed_admin(
    client_name: str,
    client_email: str,
    trip_title: str,
    trip_id: str,
) -> None:
    admin_email = os.getenv("ADMIN_EMAIL", "")
    if not admin_email:
        return

    subject = f"Client confirmed trip — {trip_title}"
    trip_url = f"{PORTAL_URL}/admin/trips/{trip_id}"

    plain = f"""Client confirmed their trip.

Client: {client_name} ({client_email})
Trip: {trip_title}

View in admin portal: {trip_url}
"""

    body = f"""<p>A client has confirmed their trip and is ready to proceed.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:8px 12px;color:{BRAND_MUTED};width:100px;">Client</td><td style="padding:8px 12px;font-weight:600;">{client_name} ({client_email})</td></tr>
    <tr style="background:#FAF6EE;"><td style="padding:8px 12px;color:{BRAND_MUTED};">Trip</td><td style="padding:8px 12px;font-weight:600;">{trip_title}</td></tr>
  </table>
  {_secondary_button(trip_url, "View in admin portal")}"""

    _send(admin_email, subject, _base_html(subject, body), plain)


def send_changes_requested_admin(
    client_name: str,
    client_email: str,
    trip_title: str,
    trip_id: str,
    message_body: str,
) -> None:
    admin_email = os.getenv("ADMIN_EMAIL", "")
    if not admin_email:
        return

    subject = f"Changes requested — {trip_title}"
    trip_url = f"{PORTAL_URL}/admin/trips/{trip_id}"

    plain = f"""A client has requested changes to their itinerary.

Client: {client_name} ({client_email})
Trip: {trip_title}

Their message:
{message_body}

View in admin portal: {trip_url}
"""

    body = f"""<p>A client has requested changes to their itinerary.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:8px 12px;color:{BRAND_MUTED};width:100px;">Client</td><td style="padding:8px 12px;font-weight:600;">{client_name} ({client_email})</td></tr>
    <tr style="background:#FAF6EE;"><td style="padding:8px 12px;color:{BRAND_MUTED};">Trip</td><td style="padding:8px 12px;font-weight:600;">{trip_title}</td></tr>
  </table>
  <div style="background:#FEF0E6;border-left:3px solid {BRAND_ORANGE};border-radius:4px;padding:14px 16px;margin:20px 0;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:{BRAND_ORANGE};text-transform:uppercase;letter-spacing:0.05em;">Client's message</p>
    <p style="margin:0;white-space:pre-wrap;font-size:14px;">{message_body}</p>
  </div>
  {_secondary_button(trip_url, "View trip in admin portal")}"""

    _send(admin_email, subject, _base_html(subject, body), plain)


def send_itinerary_ready(
    to: str,
    client_name: str,
    trip_title: str,
    trip_id: str,
) -> None:
    subject = f"Your itinerary is ready — {trip_title}"
    trip_url = f"{PORTAL_URL}/portal/trips/{trip_id}"

    plain = f"""Hi {client_name},

Your personalised itinerary for "{trip_title}" is ready.

Log in to view your full day-by-day plan. If you'd like any changes, you can chat with Maya directly from within the portal.

{trip_url}

Travel Papaya
"""

    body = f"""<p>Hi {client_name},</p>
  <p>Your personalised itinerary for <strong>{trip_title}</strong> is ready to view.</p>
  <p>If you'd like any changes, chat with Maya directly from within the portal — she'll update your itinerary in real time.</p>
  {_primary_button(trip_url, "View your itinerary")}"""

    _send(to, subject, _base_html(subject, body), plain)


def send_new_message_to_client(
    to: str,
    client_name: str,
    trip_title: str,
    trip_id: str,
    message_body: str,
) -> None:
    subject = f"New message — {trip_title}"
    trip_url = f"{PORTAL_URL}/portal/trips/{trip_id}"

    plain = f"""Hi {client_name},

You have a new message regarding your trip "{trip_title}":

---
{message_body}
---

Reply from your portal: {trip_url}

Travel Papaya
"""

    body = f"""<p>Hi {client_name},</p>
  <p>You have a new message regarding your trip <strong>{trip_title}</strong>.</p>
  <div style="background:#FAF6EE;border-left:3px solid {BRAND_ORANGE};border-radius:4px;padding:14px 16px;margin:20px 0;font-size:15px;white-space:pre-wrap;">{message_body}</div>
  {_primary_button(trip_url, "Reply in portal")}"""

    _send(to, subject, _base_html(subject, body), plain)


def send_new_message_to_admin(
    client_name: str,
    client_email: str,
    trip_title: str,
    trip_id: str,
    message_body: str,
) -> None:
    admin_email = os.getenv("ADMIN_EMAIL", "")
    if not admin_email:
        return

    subject = f"New message from {client_name} — {trip_title}"
    trip_url = f"{PORTAL_URL}/admin/trips/{trip_id}"

    plain = f"""New message from a client.

Client: {client_name} ({client_email})
Trip: {trip_title}

---
{message_body}
---

View conversation: {trip_url}
"""

    body = f"""<p>New message from a client.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:8px 12px;color:{BRAND_MUTED};width:100px;">Client</td><td style="padding:8px 12px;font-weight:600;">{client_name} ({client_email})</td></tr>
    <tr style="background:#FAF6EE;"><td style="padding:8px 12px;color:{BRAND_MUTED};">Trip</td><td style="padding:8px 12px;font-weight:600;">{trip_title}</td></tr>
  </table>
  <div style="background:#FAF6EE;border-left:3px solid {BRAND_DARK};border-radius:4px;padding:14px 16px;margin:20px 0;font-size:15px;white-space:pre-wrap;">{message_body}</div>
  {_secondary_button(trip_url, "View conversation")}"""

    _send(admin_email, subject, _base_html(subject, body), plain)
