"""Backend tests for EduAgent — booking, tools, email logging, and API endpoints."""

import os
import sys
import tempfile
from datetime import datetime, timezone

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from backend.services.booking_store import (
    Booking,
    create_booking,
    get_booking,
    get_all_bookings,
    cancel_booking,
    pop_last_booking,
    reset_store,
    generate_booking_id,
)
from backend.services.email_logger import log_email, LOG_FILE


# ═══════════════════════════════════════════════════════════════════
#  Booking Store Tests
# ═══════════════════════════════════════════════════════════════════

class TestBookingStore:
    """Tests for booking store (in-memory + SQLite)."""

    def setup_method(self):
        reset_store()

    def test_create_booking(self):
        b = create_booking(
            student_name="Alice Test",
            email="alice@test.com",
            course_slug="fullstack-web-bootcamp",
            payment_option="discounted",
        )
        assert b.student_name == "Alice Test"
        assert b.email == "alice@test.com"
        assert b.course_slug == "fullstack-web-bootcamp"
        assert b.amount_due == 999  # discounted price
        assert b.status == "confirmed"
        assert b.booking_id.startswith("DN-")
        assert b.payment_option == "discounted"

    def test_create_booking_upfront(self):
        b = create_booking(
            student_name="Bob Test",
            email="bob@test.com",
            course_slug="data-science-masterclass",
            payment_option="upfront",
        )
        assert b.amount_due == 1499  # upfront price

    def test_create_booking_early_bird(self):
        b = create_booking(
            student_name="Eve Test",
            email="eve@test.com",
            course_slug="aiml-engineering",
            payment_option="early_bird",
        )
        assert b.amount_due == 1499  # early_bird_price

    def test_create_booking_installment(self):
        b = create_booking(
            student_name="Dan Test",
            email="dan@test.com",
            course_slug="uiux-design",
            payment_option="installment",
        )
        assert b.amount_due == 799  # installment total

    def test_create_booking_invalid_course(self):
        with pytest.raises(ValueError, match="Unknown course"):
            create_booking("Test", "test@test.com", "nonexistent-course")

    def test_create_booking_invalid_payment(self):
        """Should default to something sensible for unknown payment option."""
        b = create_booking(
            student_name="Test",
            email="test@test.com",
            course_slug="fullstack-web-bootcamp",
            payment_option="invalid_option",
        )
        # Falls back to upfront_price
        assert b.amount_due == 1299

    def test_get_booking(self):
        b = create_booking("Get Test", "get@test.com", "fullstack-web-bootcamp")
        fetched = get_booking(b.booking_id)
        assert fetched is not None
        assert fetched.booking_id == b.booking_id

    def test_get_booking_not_found(self):
        assert get_booking("NONEXISTENT") is None

    def test_get_all_bookings(self):
        reset_store()
        create_booking("A", "a@test.com", "fullstack-web-bootcamp")
        create_booking("B", "b@test.com", "data-science-masterclass")
        assert len(get_all_bookings()) == 2

    def test_cancel_booking(self):
        b = create_booking("Cancel Test", "cancel@test.com", "fullstack-web-bootcamp")
        cancelled = cancel_booking(b.booking_id)
        assert cancelled is not None
        assert cancelled.status == "cancelled"
        # Verify in-memory also updated
        fetched = get_booking(b.booking_id)
        assert fetched.status == "cancelled"

    def test_cancel_booking_not_found(self):
        result = cancel_booking("DOESNOTEXIST")
        assert result is None

    def test_generate_booking_id(self):
        id1 = generate_booking_id()
        id2 = generate_booking_id()
        assert id1 != id2
        assert id1.startswith("DN-")
        assert id2.startswith("DN-")

    def test_pop_last_booking(self):
        reset_store()
        b1 = create_booking("Pop1", "p1@test.com", "fullstack-web-bootcamp")
        popped = pop_last_booking()
        assert popped is not None
        assert popped.booking_id == b1.booking_id

    def test_pop_last_booking_empty(self):
        reset_store()
        assert pop_last_booking() is None


# ═══════════════════════════════════════════════════════════════════
#  Email Logger Tests
# ═══════════════════════════════════════════════════════════════════

class TestEmailLogger:
    """Tests for the email logging service."""

    def setup_method(self):
        # Clear log file
        if os.path.exists(LOG_FILE):
            os.remove(LOG_FILE)

    def test_log_email(self):
        log_email(
            to="test@example.com",
            subject="Test Subject",
            body="Test body content",
        )
        assert os.path.exists(LOG_FILE)
        with open(LOG_FILE) as f:
            content = f.read()
        assert "test@example.com" in content
        assert "Test Subject" in content
        assert "Test body content" in content

    def test_log_multiple_emails(self):
        log_email(to="a@test.com", subject="S1", body="Body1")
        log_email(to="b@test.com", subject="S2", body="Body2")
        with open(LOG_FILE) as f:
            content = f.read()
        assert content.count("a@test.com") == 1
        assert content.count("b@test.com") == 1


# ═══════════════════════════════════════════════════════════════════
#  API Endpoint Tests (requires running server)
# ═══════════════════════════════════════════════════════════════════

class TestAPIEndpoints:
    """Integration tests against the running FastAPI server.

    These tests require the backend server to be running on port 8000.
    """

    BASE = "http://localhost:8000"

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        reset_store()
        yield

    def test_health(self):
        import httpx
        r = httpx.get(f"{self.BASE}/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_root(self):
        import httpx
        r = httpx.get(f"{self.BASE}/")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "EduAgent"
        assert "endpoints" in data

    def test_list_courses(self):
        import httpx
        r = httpx.get(f"{self.BASE}/api/courses")
        assert r.status_code == 200
        data = r.json()
        assert "courses" in data
        # Should have at least 5 courses seeded
        assert len(data["courses"]) >= 5

    def test_enroll_discounted(self):
        import httpx
        r = httpx.post(
            f"{self.BASE}/enroll",
            json={
                "student_name": "API Test",
                "email": "api@test.com",
                "course_slug": "fullstack-web-bootcamp",
                "payment_option": "discounted",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["student_name"] == "API Test"
        assert data["status"] == "confirmed"
        assert data["booking_id"].startswith("DN-")
        assert data["amount_due"] == 999

    def test_enroll_invalid_course(self):
        import httpx
        r = httpx.post(
            f"{self.BASE}/enroll",
            json={
                "student_name": "Bad",
                "email": "bad@test.com",
                "course_slug": "does-not-exist",
            },
        )
        assert r.status_code == 400

    def test_list_bookings(self):
        import httpx
        # Create one booking first
        httpx.post(
            f"{self.BASE}/enroll",
            json={
                "student_name": "List Test",
                "email": "list@test.com",
                "course_slug": "fullstack-web-bootcamp",
            },
        )
        r = httpx.get(f"{self.BASE}/bookings")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        assert len(data["bookings"]) >= 1

    def test_cancel_booking(self):
        import httpx
        # Create booking
        enroll = httpx.post(
            f"{self.BASE}/enroll",
            json={
                "student_name": "Cancel API",
                "email": "cancel_api@test.com",
                "course_slug": "fullstack-web-bootcamp",
            },
            timeout=30.0,
        ).json()
        booking_id = enroll["booking_id"]

        # Cancel it
        r = httpx.post(f"{self.BASE}/bookings/{booking_id}/cancel", timeout=30.0)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "cancelled"
        assert data["booking_id"] == booking_id

    def test_cancel_booking_not_found(self):
        import httpx
        r = httpx.post(f"{self.BASE}/bookings/NONEXISTENT/cancel")
        assert r.status_code == 404

    def test_chat_endpoint(self):
        import httpx
        r = httpx.post(
            f"{self.BASE}/chat",
            json={
                "text": "What courses do you offer?",
                "session_id": "test-session-api",
            },
            timeout=30.0,
        )
        assert r.status_code == 200
        data = r.json()
        assert "response" in data
        assert len(data["response"]) > 0

    def test_admin_emails(self):
        import httpx
        r = httpx.get(f"{self.BASE}/admin/emails")
        assert r.status_code == 200
        data = r.json()
        assert "emails" in data

    def test_admin_sessions(self):
        import httpx
        r = httpx.get(f"{self.BASE}/admin/sessions")
        assert r.status_code == 200
        data = r.json()
        assert "sessions" in data

    def test_chat_history_endpoints(self):
        import httpx
        # Save a message
        r = httpx.post(
            f"{self.BASE}/api/sessions/test-session-history",
            json={"role": "user", "content": "Hello Nova"},
        )
        assert r.status_code == 200

        # Retrieve history
        r = httpx.get(f"{self.BASE}/api/sessions/test-session-history")
        assert r.status_code == 200
        data = r.json()
        assert data["session_id"] == "test-session-history"
        assert len(data["messages"]) >= 1


# ═══════════════════════════════════════════════════════════════════
#  FEE_STRUCTURE Data Tests
# ═══════════════════════════════════════════════════════════════════

class TestFeeStructure:
    """Tests the fee structure data integrity."""

    def test_all_courses_have_required_fields(self):
        from backend.agent.tools import FEE_STRUCTURE
        required = ["title", "slug", "level", "duration_weeks", "upfront_price",
                     "discounted_price", "early_bird_price", "installment",
                     "next_cohort"]
        for slug, course in FEE_STRUCTURE.items():
            for field in required:
                assert field in course, f"{slug} missing field: {field}"
            assert "down_payment" in course["installment"]
            assert "monthly" in course["installment"]
            assert "months" in course["installment"]
            assert course["discounted_price"] <= course["upfront_price"]

    def test_scholarships_have_required_fields(self):
        from backend.agent.tools import SCHOLARSHIPS_DATA
        required = ["name", "description", "discount_pct", "eligibility"]
        for s in SCHOLARSHIPS_DATA:
            for field in required:
                assert field in s, f"Scholarship missing field: {field}"
            assert isinstance(s["discount_pct"], int)
            assert 0 < s["discount_pct"] <= 100


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-x"])
