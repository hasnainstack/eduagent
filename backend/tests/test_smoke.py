"""Basic smoke tests for the EduAgent backend.

These tests verify the server starts, endpoints respond, and critical
paths work. They use the TestClient so no live server is needed.
"""

import os
import sys
from pathlib import Path

# Ensure the project root is on the path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Set test env vars before importing the app
os.environ.setdefault("JWT_SECRET", "test-secret-key-not-for-production")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

from fastapi.testclient import TestClient

from backend.main import app

# Disable rate limiter for tests (slowapi doesn't work with TestClient)
app.state.limiter.enabled = False

client = TestClient(app)


class TestHealth:
    """Server health and basic reachability."""

    def test_root_endpoint(self):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "DevNest" in resp.text or "EduAgent" in resp.text

    def test_health_endpoint(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("ok", "degraded")
        assert "database" in data
        assert "agent" in data

    def test_cors_headers_present(self):
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200
        assert "access-control-allow-origin" in resp.headers


class TestCourses:
    """Course listing endpoint."""

    def test_list_courses(self):
        resp = client.get("/api/courses")
        assert resp.status_code == 200
        data = resp.json()
        assert "courses" in data
        # Courses should be seeded
        assert len(data["courses"]) > 0


class TestChat:
    """Chat endpoint (without actual LLM)."""

    def test_chat_without_agent(self):
        """Without LLM keys, agent is None — should get startup message."""
        resp = client.post(
            "/chat",
            json={"text": "hello", "session_id": ""},
        )
        # Should still return 200 with a message
        assert resp.status_code == 200
        data = resp.json()
        assert "response" in data


class TestEnroll:
    """Direct enrollment endpoint."""

    def test_enroll_nonexistent_course(self):
        resp = client.post(
            "/enroll",
            json={
                "student_name": "Test User",
                "email": "test@example.com",
                "course_slug": "nonexistent-course",
                "payment_option": "discounted",
            },
        )
        assert resp.status_code == 400
        assert "Unknown course" in resp.json()["detail"]

    def test_enroll_invalid_email(self):
        resp = client.post(
            "/enroll",
            json={
                "student_name": "Test User",
                "email": "not-an-email",
                "course_slug": "fullstack-web-bootcamp",
                "payment_option": "discounted",
            },
        )
        assert resp.status_code == 422  # Validation error


class TestAuth:
    """Auth endpoint smoke tests."""

    def test_login_missing_fields(self):
        resp = client.post("/auth/login", json={"email": "test@test.com"})
        assert resp.status_code == 422  # Missing password

    def test_login_wrong_creds(self):
        resp = client.post(
            "/auth/login",
            json={"email": "test@test.com", "password": "wrong"},
        )
        assert resp.status_code == 401


class TestAdmin:
    """Admin endpoints require auth."""

    def test_admin_emails_unauthorized(self):
        resp = client.get("/admin/emails")
        assert resp.status_code == 401  # Unauthorized (no auth token)

    def test_admin_sessions_unauthorized(self):
        resp = client.get("/admin/sessions")
        assert resp.status_code == 401

    def test_admin_courses_unauthorized(self):
        resp = client.get("/admin/courses")
        assert resp.status_code == 401

    def test_admin_users_unauthorized(self):
        resp = client.get("/admin/users")
        assert resp.status_code == 401

    def test_admin_instructors_unauthorized(self):
        resp = client.get("/admin/instructors")
        assert resp.status_code == 401
