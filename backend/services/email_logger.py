"""Email logging service.

Logs "confirmation emails" to a local file for demo purposes.
In production, replace with actual SMTP/sendgrid integration.
"""

import os
from datetime import datetime, timezone

from backend.core.logging_config import get_logger

log = get_logger("email_logger")


LOG_FILE = os.getenv(
    "EMAIL_LOG_PATH",
    os.path.join(os.path.dirname(__file__), "..", "data", "emails.log"),
)


def log_email(to: str, subject: str, body: str):
    """Log an email to a local file."""
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        timestamp = datetime.now(timezone.utc).isoformat()
        line = (
            f"{'='*60}\n"
            f"Timestamp: {timestamp}\n"
            f"To: {to}\n"
            f"Subject: {subject}\n"
            f"{'-'*60}\n"
            f"{body}\n"
            f"{'='*60}\n\n"
        )
        with open(LOG_FILE, "a") as f:
            f.write(line)
        log.info("Email logged -> %s | %s", to, subject)
    except Exception as e:
        log.error("Failed to log email: %s", e)
