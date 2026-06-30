"""Database setup with dual SQLite/PostgreSQL support.

In production (Render + Supabase), uses PostgreSQL via DATABASE_URL env var.
In local development, falls back to SQLite with zero config.

All SQLAlchemy models are defined here and are shared across both backends.
"""

import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from backend.core.logging_config import get_logger
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, Text, create_engine, event,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

dotenv_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path)

log = get_logger("database")

# ── Connection ──────────────────────────────────────────────────

# Production: use DATABASE_URL (PostgreSQL from Supabase)
# Local dev: use SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    DB_PATH = os.getenv("SQLITE_PATH", str(Path(__file__).resolve().parent / "eduagent.db"))
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    log.info("Using SQLite: %s", DB_PATH)
    is_sqlite = True
else:
    log.info("Using PostgreSQL from DATABASE_URL")
    is_sqlite = False

# ── Engine ───────────────────────────────────────────────────────

engine_kwargs = {"echo": False}

if is_sqlite:
    # SQLite needs this threading flag and no connection pooling
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"] = NullPool
else:
    # PostgreSQL pool settings (good for Render free tier 512MB RAM)
    # pool_recycle prevents stale connections from cloud DBs (Supabase, RDS, etc.)
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 5
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 3600  # Recycle connections after 1 hour

engine = create_engine(DATABASE_URL, **engine_kwargs)


if is_sqlite:

    @event.listens_for(Engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_session() -> Session:
    """Get a database session (works with both SQLite and PostgreSQL)."""
    return SessionLocal()


def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(engine)


def seed_db():
    """Seed initial data if tables are empty."""
    from backend.agent.tools import FEE_STRUCTURE, SUBSCRIPTION_PLANS, SCHOLARSHIPS_DATA

    session = get_session()
    try:
        needs_commit = False

        # Seed courses if empty
        if session.query(Course).count() == 0:
            log.info("Seeding courses...")
            for slug, c in FEE_STRUCTURE.items():
                course = Course(
                    slug=slug,
                    title=c["title"],
                    level=c["level"],
                    duration_weeks=c["duration_weeks"],
                    price_usd=float(c["upfront_price"]),
                    discounted_price=float(c["discounted_price"]),
                    next_cohort_start=c["next_cohort"],
                    enrollment_open=True,
                    short_description=f"{c['title']} - {c['level']} level, {c['duration_weeks']} weeks. Next cohort: {c['next_cohort']}",
                )
                session.add(course)
            log.info("Seeded %d courses", len(FEE_STRUCTURE))
            needs_commit = True

        # Seed pricing plans if empty
        if session.query(PricingPlan).count() == 0:
            for slug, p in SUBSCRIPTION_PLANS.items():
                features_str = ", ".join(p["features"]) if p["features"] else ""
                plan = PricingPlan(
                    slug=slug,
                    name=p["name"],
                    price_monthly=float(p["price_monthly"]) if p["price_monthly"] else 0,
                    features=features_str,
                    is_popular=p["is_popular"],
                )
                session.add(plan)
            log.info("Seeded %d pricing plans", len(SUBSCRIPTION_PLANS))
            needs_commit = True

        # Seed scholarships if empty
        if session.query(Scholarship).count() == 0:
            for s in SCHOLARSHIPS_DATA:
                scholarship = Scholarship(
                    name=s["name"],
                    description=s["description"],
                    discount_pct=s["discount_pct"],
                    eligibility=s["eligibility"],
                    deadline=s.get("deadline", ""),
                    apply_url=s.get("apply_url", ""),
                )
                session.add(scholarship)
            log.info("Seeded %d scholarships", len(SCHOLARSHIPS_DATA))
            needs_commit = True

        # Seed default admin user if no users exist
        if session.query(User).count() == 0:
            import bcrypt
            admin = User(
                email="admin@devnestacademy.com",
                password_hash=bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8"),
                full_name="Admin User",
                role="admin",
                is_active=True,
            )
            session.add(admin)
            log.info("Created default admin: admin@devnestacademy.com / admin123")
            needs_commit = True

        if needs_commit:
            session.commit()
    finally:
        session.close()


# ── Models ────────────────────────────────────────────────────────

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    slug = Column(Text, unique=True, nullable=False)
    title = Column(Text, nullable=False)
    level = Column(Text)
    duration_weeks = Column(Integer)
    price_usd = Column(Float)
    discounted_price = Column(Float)
    next_cohort_start = Column(Text)
    short_description = Column(Text)
    enrollment_open = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True)
    booking_id = Column(Text, unique=True, nullable=False)
    student_name = Column(Text, nullable=False)
    email = Column(Text, nullable=False)
    course_slug = Column(Text, nullable=False)
    course_title = Column(Text, nullable=False)
    amount_due = Column(Float)
    payment_option = Column(Text)
    status = Column(Text, default="confirmed")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True)
    session_id = Column(Text, index=True, nullable=False)
    role = Column(Text, nullable=False)  # "user" or "ai"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PricingPlan(Base):
    __tablename__ = "pricing_plans"

    id = Column(Integer, primary_key=True)
    slug = Column(Text, unique=True, nullable=False)
    name = Column(Text, nullable=False)
    price_monthly = Column(Float, default=0)
    features = Column(Text)
    is_popular = Column(Boolean, default=False)


class Scholarship(Base):
    __tablename__ = "scholarships"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    description = Column(Text)
    discount_pct = Column(Integer)
    eligibility = Column(Text)
    deadline = Column(Text)
    apply_url = Column(Text)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(Text, unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    full_name = Column(Text, nullable=False)
    role = Column(Text, nullable=False, default="admin")  # "admin" or "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Instructor(Base):
    __tablename__ = "instructors"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    title = Column(Text, default="")
    bio = Column(Text, default="")
    expertise = Column(Text, default="")  # comma-separated
    linkedin_url = Column(Text, default="")
    avatar_url = Column(Text, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
