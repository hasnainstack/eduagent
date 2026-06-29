"""Booking store for course enrollments.

Writes to both SQLite (persistent) and in-memory cache (fast access).
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from backend.agent.tools import FEE_STRUCTURE
from backend.core.logging_config import get_logger

log = get_logger("booking_store")


# ── Booking Record ───────────────────────────────────────────────

@dataclass
class Booking:
    booking_id: str
    student_name: str
    email: str
    course_slug: str
    course_title: str
    amount_due: float
    payment_option: str
    status: str  # confirmed, pending, cancelled
    created_at: str
    notes: str = ""


# ── In-Memory Cache ──────────────────────────────────────────────

_bookings: dict[str, Booking] = {}
_counter: int = 0
_last_created_id: Optional[str] = None


def load_from_sqlite():
    """Load bookings from SQLite into memory at startup."""
    try:
        from backend.db.sqlite_setup import Booking as SQLBooking, get_session
        db = get_session()
        try:
            records = db.query(SQLBooking).order_by(SQLBooking.created_at).all()
            for r in records:
                b = Booking(
                    booking_id=r.booking_id,
                    student_name=r.student_name,
                    email=r.email,
                    course_slug=r.course_slug,
                    course_title=r.course_title,
                    amount_due=r.amount_due,
                    payment_option=r.payment_option,
                    status=r.status,
                    created_at=r.created_at.isoformat() if hasattr(r.created_at, 'isoformat') else str(r.created_at),
                )
                _bookings[r.booking_id] = b
            global _counter
            _counter = len(records)
            log.info("Loaded %d bookings from SQLite", len(records))
        finally:
            db.close()
    except Exception as e:
        log.warning("Could not load bookings from SQLite (non-fatal): %s", e)


def _save_to_sqlite(booking: Booking):
    """Persist a booking to SQLite."""
    try:
        from backend.db.sqlite_setup import Booking as SQLBooking, get_session
        db = get_session()
        try:
            record = SQLBooking(
                booking_id=booking.booking_id,
                student_name=booking.student_name,
                email=booking.email,
                course_slug=booking.course_slug,
                course_title=booking.course_title,
                amount_due=booking.amount_due,
                payment_option=booking.payment_option,
                status=booking.status,
            )
            db.add(record)
            db.commit()
        finally:
            db.close()
    except Exception as e:
        log.warning("Could not persist booking to SQLite (non-fatal): %s", e)


def generate_booking_id() -> str:
    global _counter
    if _counter == 0:
        # Initialise counter from SQLite to avoid collisions on restart
        try:
            from backend.db.sqlite_setup import Booking as SQLBooking, get_session
            db = get_session()
            try:
                max_record = db.query(SQLBooking).order_by(SQLBooking.id.desc()).first()
                if max_record and max_record.booking_id:
                    parts = max_record.booking_id.split("-")
                    _counter = int(parts[-1])
            finally:
                db.close()
        except Exception as e:
            log.warning("Could not initialise booking counter from SQLite: %s", e)
    _counter += 1
    ts = datetime.now(timezone.utc).strftime("%y%m%d")
    return f"DN-{ts}-{_counter:04d}"


def _existing_enrollment(email: str, exclude_id: Optional[str] = None) -> Optional[Booking]:
    """Check if this email already has a confirmed booking (across memory + SQLite).

    Returns the existing booking if found, None otherwise.
    """
    # First check in-memory cache (fast)
    for b in _bookings.values():
        if b.email.lower() == email.lower() and b.status == "confirmed":
            if exclude_id and b.booking_id == exclude_id:
                continue
            return b
    # Then check SQLite for any that might not be in memory yet
    try:
        from backend.db.sqlite_setup import Booking as SQLBooking, get_session
        db = get_session()
        try:
            existing = (
                db.query(SQLBooking)
                .filter(SQLBooking.email == email, SQLBooking.status == "confirmed")
                .first()
            )
            if existing and (not exclude_id or existing.booking_id != exclude_id):
                return Booking(
                    booking_id=existing.booking_id,
                    student_name=existing.student_name,
                    email=existing.email,
                    course_slug=existing.course_slug,
                    course_title=existing.course_title,
                    amount_due=existing.amount_due,
                    payment_option=existing.payment_option,
                    status=existing.status,
                    created_at=existing.created_at.isoformat()
                    if hasattr(existing.created_at, "isoformat")
                    else str(existing.created_at),
                )
        finally:
            db.close()
    except Exception as e:
        log.warning("Could not check existing enrollment in SQLite: %s", e)
    return None


def create_booking(
    student_name: str,
    email: str,
    course_slug: str,
    payment_option: str = "discounted",
) -> Booking:
    """Create a new booking. Stores in memory + SQLite.

    Raises ValueError if this email already has a confirmed booking
    (one course per student policy).
    """
    # ── Enforce one-course-per-student policy ──
    existing = _existing_enrollment(email)
    if existing:
        raise ValueError(
            f"An enrollment already exists for {email} in course "
            f"'{existing.course_title}' (ID: {existing.booking_id}). "
            f"Each student may only enroll in one course at a time."
        )

    course = FEE_STRUCTURE.get(course_slug)
    if not course:
        for slug, data in FEE_STRUCTURE.items():
            if slug == course_slug or data["title"].lower() == course_slug.lower():
                course = data
                course_slug = slug
                break
    if not course:
        raise ValueError(f"Unknown course: {course_slug}")

    amount = course["upfront_price"]
    if payment_option == "discounted":
        amount = course["discounted_price"]
    elif payment_option == "early_bird":
        amount = course["early_bird_price"]
    elif payment_option == "installment":
        amount = course["installment"]["total"]
    elif payment_option == "scholarship":
        amount = course["discounted_price"]

    booking = Booking(
        booking_id=generate_booking_id(),
        student_name=student_name,
        email=email,
        course_slug=course_slug,
        course_title=course["title"],
        amount_due=float(amount),
        payment_option=payment_option,
        status="confirmed",
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    _bookings[booking.booking_id] = booking
    global _last_created_id
    _last_created_id = booking.booking_id

    # Persist to SQLite in background
    _save_to_sqlite(booking)

    return booking


def get_booking(booking_id: str) -> Optional[Booking]:
    return _bookings.get(booking_id)


def get_all_bookings() -> list[Booking]:
    return list(_bookings.values())


def cancel_booking(booking_id: str) -> Optional[Booking]:
    booking = _bookings.get(booking_id)
    if booking:
        booking.status = "cancelled"
        # Update SQLite
        try:
            from backend.db.sqlite_setup import Booking as SQLBooking, get_session
            db = get_session()
            try:
                db.query(SQLBooking).filter(SQLBooking.booking_id == booking_id).update({"status": "cancelled"})
                db.commit()
            finally:
                db.close()
        except Exception as e:
            log.warning("Failed to update booking status in SQLite: %s", e)
    return booking


def get_last_booking_id() -> Optional[str]:
    if not _bookings:
        return None
    return max(_bookings.keys())


def pop_last_booking() -> Optional[Booking]:
    global _last_created_id
    if _last_created_id and _last_created_id in _bookings:
        booking = _bookings[_last_created_id]
        _last_created_id = None
        return booking
    if _bookings:
        latest = max(_bookings.keys())
        booking = _bookings[latest]
        return booking
    return None


def reset_store():
    """Clear all bookings (useful for testing)."""
    _bookings.clear()
    global _counter, _last_created_id
    _counter = 0
    _last_created_id = None
    try:
        from backend.db.sqlite_setup import Booking as SQLBooking, get_session
        db = get_session()
        try:
            db.query(SQLBooking).delete()
            db.commit()
        finally:
            db.close()
    except Exception as e:
        log.warning("Failed to clear bookings from SQLite: %s", e)
