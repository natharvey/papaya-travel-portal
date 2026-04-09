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


def _send(to: str, subject: str, html: str, plain: str) -> None:
    """Send an email via Gmail SMTP. Logs and swallows errors so callers never crash."""
    if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
        logger.warning("Email not configured — skipping send to %s", to)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Papaya Travel <{EMAIL_ADDRESS}>"
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
    """Send a standalone login link email (no reference code)."""
    subject = "Your Papaya Travel login link"

    plain = f"""Hi {client_name},

Here is your one-click login link for the Papaya Travel portal:

{magic_link}

This link expires in 1 hour and can only be used once.

If you didn't request this, you can safely ignore this email.

The Papaya Travel Team
"""

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #2D3A4A; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 4px solid #F97316; padding-top: 24px; margin-bottom: 32px;">
    <h1 style="color: #F97316; margin: 0;">Papaya Travel</h1>
  </div>

  <p>Hi {client_name},</p>

  <p>Click the button below to log in to your Papaya Travel portal:</p>

  <p>
    <a href="{magic_link}"
       style="background: #F97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 700; font-size: 15px;">
      Log in to your portal
    </a>
  </p>

  <p style="font-size: 12px; color: #94A3B8; margin-top: 4px;">This link expires in 1 hour and can only be used once.</p>

  <p style="font-size: 13px; color: #94A3B8; margin-top: 32px;">
    If you didn't request this, you can safely ignore this email.
  </p>

  <p>The Papaya Travel Team</p>
</body>
</html>
"""

    _send(to, subject, html, plain)


def send_intake_confirmation(
    to: str,
    client_name: str,
    reference_code: str,
    trip_title: str,
    magic_link: Optional[str] = None,
) -> None:
    subject = "Your Papaya Travel enquiry has been received"

    login_line = f"\nOr log in with your code at: {PORTAL_URL}/login\n" if magic_link else f"\nLog in at: {PORTAL_URL}/login\n"
    magic_section_plain = f"Jump straight in:\n{magic_link}\n(This link expires in 1 hour){login_line}" if magic_link else f"Log in at: {PORTAL_URL}/login"

    plain = f"""Hi {client_name},

Thanks for your enquiry — we've received your trip request and our team will be in touch soon.

{magic_section_plain}

Your portal login details (keep these safe):
  Email:          {to}
  Reference code: {reference_code}

Trip: {trip_title}

The Papaya Travel Team
"""

    magic_button = f"""
  <p>
    <a href="{magic_link}"
       style="background: #F97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 700; font-size: 15px;">
      Log in to your portal
    </a>
  </p>
  <p style="font-size: 12px; color: #94A3B8; margin-top: 4px;">This link expires in 1 hour and can only be used once.</p>
""" if magic_link else f"""
  <p>
    <a href="{PORTAL_URL}/login"
       style="background: #F97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 700; font-size: 15px;">
      Log in to your portal
    </a>
  </p>
"""

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #2D3A4A; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 4px solid #F97316; padding-top: 24px; margin-bottom: 32px;">
    <h1 style="color: #F97316; margin: 0;">Papaya Travel</h1>
  </div>

  <p>Hi {client_name},</p>

  <p>Thanks for your enquiry — we've received your trip request and our team will be in touch soon.</p>

  {magic_button}

  <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B;">Your login details — keep these safe</p>
    <p style="margin: 4px 0; font-size: 14px;">Email: <code style="background: #E2E8F0; padding: 2px 6px; border-radius: 4px;">{to}</code></p>
    <p style="margin: 8px 0 4px 0; font-size: 14px;">Reference code: <code style="font-size: 20px; color: #F97316; font-weight: bold; background: #FFF7ED; padding: 4px 10px; border-radius: 4px;">{reference_code}</code></p>
    <p style="margin: 12px 0 0 0; font-size: 13px; color: #64748B;">Trip: {trip_title}</p>
  </div>

  <p style="font-size: 13px; color: #94A3B8; margin-top: 32px;">
    The magic link above expires in 1 hour. After that, use your email and reference code to log in at <a href="{PORTAL_URL}/login" style="color: #F97316;">{PORTAL_URL}/login</a>.
  </p>

  <p>The Papaya Travel Team</p>
</body>
</html>
"""

    _send(to, subject, html, plain)


def send_itinerary_for_review(
    to: str,
    client_name: str,
    trip_title: str,
    trip_id: str,
) -> None:
    subject = f"Your Papaya itinerary is ready for review — {trip_title}"
    trip_url = f"{PORTAL_URL}/portal/trips/{trip_id}"

    plain = f"""Hi {client_name},

Your personalised itinerary for "{trip_title}" is ready for your review.

Please log in to your portal to view the full day-by-day plan and let us know if you're happy to confirm, or if you'd like any changes:
{trip_url}

You can message our team directly from within the portal with any feedback.

The Papaya Travel Team
"""

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #2D3A4A; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 4px solid #FF6B35; padding-top: 24px; margin-bottom: 32px;">
    <h1 style="color: #FF6B35; margin: 0;">Papaya Travel</h1>
  </div>

  <p>Hi {client_name},</p>

  <p>Your personalised itinerary for <strong>{trip_title}</strong> is ready for your review.</p>

  <p>Please log in to view the full day-by-day plan and let us know if you're happy to confirm, or if you'd like any changes.</p>

  <p>
    <a href="{trip_url}"
       style="background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Review your itinerary
    </a>
  </p>

  <p>You can message our team directly from within the portal with any feedback.</p>

  <p>The Papaya Travel Team</p>
</body>
</html>
"""

    _send(to, subject, html, plain)


def send_trip_confirmed_client(
    to: str,
    client_name: str,
    trip_title: str,
    trip_id: str,
) -> None:
    subject = f"Your trip is confirmed — {trip_title}"
    trip_url = f"{PORTAL_URL}/portal/trips/{trip_id}"

    plain = f"""Hi {client_name},

Your trip "{trip_title}" is now confirmed. We're excited to help make it happen!

Our team will be in touch with next steps. You can log in to your portal any time to view your itinerary and send us a message:
{trip_url}

The Papaya Travel Team
"""

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #2D3A4A; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 4px solid #FF6B35; padding-top: 24px; margin-bottom: 32px;">
    <h1 style="color: #FF6B35; margin: 0;">Papaya Travel</h1>
  </div>

  <p>Hi {client_name},</p>

  <p>Your trip <strong>{trip_title}</strong> is now confirmed. We're excited to help make it happen!</p>

  <p>Our team will be in touch with next steps. You can log in to your portal any time to view your itinerary and message us.</p>

  <p>
    <a href="{trip_url}"
       style="background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      View your confirmed trip
    </a>
  </p>

  <p>The Papaya Travel Team</p>
</body>
</html>
"""

    _send(to, subject, html, plain)


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

    plain = f"""A client has confirmed their trip.

Client: {client_name} ({client_email})
Trip: {trip_title}

View in admin portal: {trip_url}
"""

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #2D3A4A; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 4px solid #FF6B35; padding-top: 24px; margin-bottom: 32px;">
    <h1 style="color: #FF6B35; margin: 0;">Papaya Travel — Admin Notification</h1>
  </div>

  <p>A client has confirmed their trip and is ready to proceed.</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 8px; color: #666; width: 120px;">Client</td><td style="padding: 8px; font-weight: 600;">{client_name} ({client_email})</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding: 8px; color: #666;">Trip</td><td style="padding: 8px; font-weight: 600;">{trip_title}</td></tr>
  </table>

  <p>
    <a href="{trip_url}"
       style="background: #2D3A4A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      View in admin portal
    </a>
  </p>
</body>
</html>
"""

    _send(admin_email, subject, html, plain)


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

    subject = f"Client requested changes — {trip_title}"
    trip_url = f"{PORTAL_URL}/admin/trips/{trip_id}"

    plain = f"""A client has requested changes to their itinerary.

Client: {client_name} ({client_email})
Trip: {trip_title}

Their message:
{message_body}

View in admin portal: {trip_url}
"""

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #2D3A4A; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 4px solid #F97316; padding-top: 24px; margin-bottom: 32px;">
    <h1 style="color: #F97316; margin: 0;">Papaya Travel — Changes Requested</h1>
  </div>

  <p>A client has reviewed their itinerary and requested changes. The trip has been moved back to <strong>Draft</strong>.</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 8px; color: #666; width: 120px;">Client</td><td style="padding: 8px; font-weight: 600;">{client_name} ({client_email})</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding: 8px; color: #666;">Trip</td><td style="padding: 8px; font-weight: 600;">{trip_title}</td></tr>
  </table>

  <div style="background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 6px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #C2410C; text-transform: uppercase; letter-spacing: 0.5px;">Client's message</p>
    <p style="margin: 0; white-space: pre-wrap;">{message_body}</p>
  </div>

  <p>
    <a href="{trip_url}"
       style="background: #2D3A4A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      View trip in admin portal
    </a>
  </p>
</body>
</html>
"""

    _send(admin_email, subject, html, plain)


def send_itinerary_ready(
    to: str,
    client_name: str,
    trip_title: str,
    trip_id: str,
) -> None:
    subject = f"Your Papaya itinerary is ready — {trip_title}"
    trip_url = f"{PORTAL_URL}/trip/{trip_id}"

    plain = f"""Hi {client_name},

Great news — your personalised itinerary for "{trip_title}" is ready to view.

Log in to your portal to see the full day-by-day plan:
{trip_url}

If you have any questions or want changes, you can message our team directly from within the portal.

The Papaya Travel Team
"""

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #2D3A4A; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 4px solid #FF6B35; padding-top: 24px; margin-bottom: 32px;">
    <h1 style="color: #FF6B35; margin: 0;">Papaya Travel</h1>
  </div>

  <p>Hi {client_name},</p>

  <p>Great news — your personalised itinerary for <strong>{trip_title}</strong> is ready to view.</p>

  <p>
    <a href="{trip_url}"
       style="background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      View your itinerary
    </a>
  </p>

  <p>If you have any questions or want changes, you can message our team directly from within the portal.</p>

  <p>The Papaya Travel Team</p>
</body>
</html>
"""

    _send(to, subject, html, plain)


def send_new_message_to_client(
    to: str,
    client_name: str,
    trip_title: str,
    trip_id: str,
    message_body: str,
) -> None:
    subject = f"New message from Papaya Travel — {trip_title}"
    trip_url = f"{PORTAL_URL}/portal/trips/{trip_id}"

    plain = f"""Hi {client_name},

You have a new message from the Papaya Travel team regarding your trip "{trip_title}".

---
{message_body}
---

Reply and view your full conversation here: {trip_url}

The Papaya Travel Team
"""

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #2D3A4A; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 4px solid #F97316; padding-top: 24px; margin-bottom: 32px;">
    <h1 style="color: #F97316; margin: 0;">Papaya Travel</h1>
  </div>

  <p>Hi {client_name},</p>
  <p>You have a new message from our team regarding your trip <strong>{trip_title}</strong>.</p>

  <div style="background: #F8FAFC; border-left: 4px solid #F97316; border-radius: 4px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; white-space: pre-wrap; font-size: 15px;">{message_body}</p>
  </div>

  <p>
    <a href="{trip_url}"
       style="background: #F97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
      Reply in portal
    </a>
  </p>

  <p style="color: #94A3B8; font-size: 13px;">The Papaya Travel Team</p>
</body>
</html>
"""

    _send(to, subject, html, plain)


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

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #2D3A4A; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 4px solid #2D3A4A; padding-top: 24px; margin-bottom: 32px;">
    <h1 style="color: #2D3A4A; margin: 0;">Papaya Travel — Admin Notification</h1>
  </div>

  <p>New message from a client.</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 8px; color: #666; width: 120px;">Client</td><td style="padding: 8px; font-weight: 600;">{client_name} ({client_email})</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding: 8px; color: #666;">Trip</td><td style="padding: 8px; font-weight: 600;">{trip_title}</td></tr>
  </table>

  <div style="background: #F8FAFC; border-left: 4px solid #2D3A4A; border-radius: 4px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; white-space: pre-wrap; font-size: 15px;">{message_body}</p>
  </div>

  <p>
    <a href="{trip_url}"
       style="background: #2D3A4A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      View in admin portal
    </a>
  </p>
</body>
</html>
"""

    _send(admin_email, subject, html, plain)
