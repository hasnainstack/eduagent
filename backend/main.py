"""FastAPI application for EduAgent — DevNest Academy Voice Sales Agent.

Endpoints:
- POST /chat — text chat with Nova agent
- POST /enroll — direct enrollment without agent
- GET /health — health check (with DB check)
- WebSocket /ws/voice — real-time voice pipeline (STT → agent → TTS)
"""

import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import sentry_sdk

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

# Ensure .env is loaded regardless of CWD
dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)

from backend.agent.chain import create_agent_executor, run_agent
from backend.agent.tools import FEE_STRUCTURE
from backend.auth.dependencies import get_current_user, get_optional_user, require_admin
from backend.auth.router import router as auth_router
from backend.admin.router import router as admin_router
from backend.user.router import router as user_router
from backend.core.env import validate_env
from backend.core.logging_config import get_logger, setup_logging
from backend.db.sqlite_setup import Booking, Course as SQLCourse, get_session, init_db, seed_db
from backend.services.booking_store import (
    Booking,
    cancel_booking,
    create_booking,
    get_all_bookings,
    get_booking,
)
from backend.services.email_logger import log_email
from backend.services.stt import transcribe_audio
from backend.services.tts import synthesize_speech

# Setup structured logging
setup_logging(os.getenv("LOG_LEVEL", "INFO"))
log = get_logger("main")

# Sentry error monitoring
sentry_dsn = os.getenv("SENTRY_DSN", "")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv("ENVIRONMENT", "development"),
        traces_sample_rate=0.1,
    )
    log.info("Sentry error monitoring enabled")
else:
    log.info("Sentry not configured (set SENTRY_DSN to enable)")

# ── App Setup ─────────────────────────────────────────────────

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "https://eduagent-zeta.vercel.app",
).split(",")

log.info("CORS allowed origins: %s", cors_origins)

agent_executor = None

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise DB, agent, and validate environment."""
    global agent_executor

    # Validate env on startup
    validate_env()

    log.info("Initialising database...")
    try:
        init_db()
        seed_db()
        from backend.services.booking_store import load_from_database

        load_from_database()
        log.info("Database ready.")
    except Exception as e:
        log.warning("Database init warning (non-fatal): %s", e)

    log.info("Initialising Nova agent...")
    try:
        agent_executor = create_agent_executor()
        log.info("Nova agent ready.")
    except Exception as e:
        log.error("Failed to initialise Nova agent: %s", e)
        agent_executor = None

    yield
    log.info("Shutting down.")


app = FastAPI(title="EduAgent", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth, admin, and user routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(user_router)

# Serve static frontend build (Next.js export to backend/static/)
STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/_next", StaticFiles(directory=str(STATIC_DIR / "_next")), name="next-assets")
    for static_sub in ["images", "fonts"]:
        sub_path = STATIC_DIR / static_sub
        if sub_path.exists():
            app.mount(f"/{static_sub}", StaticFiles(directory=str(sub_path)), name=static_sub)
    log.info("Frontend static build found, serving from %s", STATIC_DIR)

AGENT_TIMEOUT = int(os.getenv("AGENT_TIMEOUT_SECONDS", "30"))


# ── REST Endpoints ────────────────────────────────────────────


@app.get("/", include_in_schema=False)
async def root():
    """Serve the frontend index if the static build exists, else show API info."""
    from fastapi.responses import HTMLResponse

    if STATIC_DIR.exists():
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return HTMLResponse(content=index_path.read_text(encoding="utf-8"))
    return {
        "name": "EduAgent",
        "version": "1.0.0",
        "endpoints": {k: f"/{k}" for k in ("health", "chat", "enroll")},
    }


@app.get("/health")
@limiter.limit("30/minute")
async def health(request: Request):
    """Health check with database reachability test."""
    db_ok = False
    try:
        session = get_session()
        session.execute(
            __import__("sqlalchemy").text("SELECT 1")
        )
        session.close()
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "agent": "ready" if agent_executor is not None else "unavailable",
    }


# ── Courses from SQLite ──────────────────────────────────────────


@app.get("/api/courses")
async def list_courses_sqlite():
    """Return courses from the SQLite database."""
    from backend.db.sqlite_setup import get_session

    session = get_session()
    try:
        courses = session.query(SQLCourse).order_by(SQLCourse.title).all()
        return {
            "courses": [
                {
                    "id": c.id,
                    "slug": c.slug,
                    "title": c.title,
                    "level": c.level,
                    "duration_weeks": c.duration_weeks,
                    "price_usd": c.price_usd,
                    "discounted_price": c.discounted_price,
                    "next_cohort_start": c.next_cohort_start,
                    "enrollment_open": c.enrollment_open,
                }
                for c in courses
            ]
        }
    finally:
        session.close()


# ── Chat History ──────────────────────────────────────────────────


@app.get("/api/sessions/{session_id}")
async def get_chat_history(session_id: str):
    """Retrieve saved chat history for a session."""
    from backend.db.sqlite_setup import ChatSession, get_session

    session = get_session()
    try:
        msgs = (
            session.query(ChatSession)
            .filter(ChatSession.session_id == session_id)
            .order_by(ChatSession.created_at)
            .all()
        )
        return {
            "session_id": session_id,
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    "timestamp": m.created_at.isoformat(),
                }
                for m in msgs
            ],
        }
    finally:
        session.close()


@app.post("/api/sessions/{session_id}")
async def save_chat_message(session_id: str, msg: dict):
    """Save a chat message to the session history."""
    from backend.db.sqlite_setup import ChatSession, get_session

    db = get_session()
    try:
        record = ChatSession(
            session_id=session_id,
            role=msg.get("role", "user"),
            content=msg.get("content", ""),
        )
        db.add(record)
        db.commit()
        return {"saved": True}
    except Exception as e:
        log.error("Failed to save chat message: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save message")
    finally:
        db.close()


# ── Chat REST Endpoint ──────────────────────────────────────────


class ChatRequest(BaseModel):
    text: str
    session_id: str = ""


class ChatResponse(BaseModel):
    response: str
    function_called: Optional[str] = None
    booking_created: bool = False
    booking_id: Optional[str] = None
    booking_details: Optional[dict] = None


@app.post("/chat")
@limiter.limit("20/minute")
async def chat(
    req: ChatRequest,
    request: Request,
    current_user=Depends(get_optional_user),
):
    """Process a text message through the Nova agent and return the reply."""
    if agent_executor is None:
        return ChatResponse(response="Agent is starting up. Please try again in a moment.")

    # Save user message to session history
    if req.session_id:
        try:
            from backend.db.sqlite_setup import ChatSession, get_session

            db = get_session()
            db.add(
                ChatSession(
                    session_id=req.session_id,
                    role="user",
                    content=req.text,
                )
            )
            db.commit()
            db.close()
        except Exception as e:
            log.warning("Failed to save user chat message: %s", e)

    # Run agent with timeout
    try:
        result = await asyncio.wait_for(
            run_agent(req.text, agent_executor, session_id=req.session_id, user=current_user),
            timeout=AGENT_TIMEOUT,
        )
    except asyncio.TimeoutError:
        log.warning("Agent execution timed out after %ds", AGENT_TIMEOUT)
        return ChatResponse(
            response="I'm taking too long to respond. Could you please try again?",
        )
    except Exception as e:
        log.error("Agent execution error: %s", e, exc_info=True)
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(e)
        except ImportError:
            pass
        return ChatResponse(
            response="I'm sorry, something went wrong. Please try again.",
        )

    # Save agent response to session history
    if req.session_id:
        try:
            from backend.db.sqlite_setup import ChatSession, get_session

            db = get_session()
            db.add(
                ChatSession(
                    session_id=req.session_id,
                    role="ai",
                    content=result["response"],
                )
            )
            db.commit()
            db.close()
        except Exception as e:
            log.warning("Failed to save AI chat message: %s", e)

    # Log email if booking was created
    if result["booking_created"] and result["booking_details"]:
        log_email(
            to=result["booking_details"]["email"],
            subject=f"Enrollment Confirmed — {result['booking_details']['course_title']}",
            body=f"Dear {result['booking_details']['student_name']},\n\n"
            f"Your enrollment in {result['booking_details']['course_title']} is confirmed!\n"
            f"Booking ID: {result['booking_details']['booking_id']}\n"
            f"Amount Due: ${result['booking_details']['amount_due']:.2f}\n"
            f"Payment Option: {result['booking_details']['payment_option']}\n\n"
            f"Welcome to DevNest Academy!\n"
            f"The Nova Team",
        )

    return ChatResponse(
        response=result["response"],
        booking_created=result["booking_created"],
        booking_id=result["booking_id"],
        booking_details=result["booking_details"],
    )


# ── Booking Management ────────────────────────────────────────


@app.post("/bookings/{booking_id}/cancel")
async def cancel_booking_endpoint(
    booking_id: str,
    current_user=Depends(get_current_user),
):
    """Cancel a booking by ID. User must own the booking or be admin."""
    from backend.db.sqlite_setup import User as UserModel

    booking = cancel_booking(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking {booking_id} not found")

    # Verify ownership: admin can cancel any, users can only cancel their own
    if current_user.role != "admin" and booking.email != current_user.email:
        raise HTTPException(
            status_code=403,
            detail="You can only cancel your own bookings",
        )

    # Log cancellation email
    log_email(
        to=booking.email,
        subject=f"Booking Cancelled — {booking.course_title}",
        body=f"Dear {booking.student_name},\n\n"
        f"Your booking for {booking.course_title} (ID: {booking.booking_id}) has been cancelled.\n\n"
        f"If this was a mistake, please contact support@devnestacademy.com\n\n"
        f"The Nova Team",
    )

    return {
        "booking_id": booking.booking_id,
        "status": booking.status,
        "message": f"Booking {booking.booking_id} has been cancelled.",
    }


# ── Direct Enrollment Endpoint ──────────────────────────────────


class EnrollRequest(BaseModel):
    student_name: str
    email: EmailStr
    course_slug: str
    payment_option: str = "discounted"


class EnrollResponse(BaseModel):
    booking_id: str
    student_name: str
    email: str
    course_title: str
    amount_due: float
    payment_option: str
    status: str
    message: str


@app.post("/enroll")
@limiter.limit("10/minute")
async def enroll(
    req: EnrollRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Direct enrollment without going through the agent. Requires authentication."""
    try:
        booking = create_booking(
            student_name=req.student_name,
            email=req.email,
            course_slug=req.course_slug,
            payment_option=req.payment_option,
        )
        return EnrollResponse(
            booking_id=booking.booking_id,
            student_name=booking.student_name,
            email=booking.email,
            course_title=booking.course_title,
            amount_due=booking.amount_due,
            payment_option=booking.payment_option,
            status=booking.status,
            message=f"Enrollment confirmed! Welcome to {booking.course_title}, {booking.student_name}! "
            f"Your booking ID is {booking.booking_id}.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/bookings")
@limiter.limit("30/minute")
async def list_bookings(request: Request):
    """List all current bookings (for demo purposes)."""
    all_b = get_all_bookings()
    return {
        "total": len(all_b),
        "bookings": [
            {
                "booking_id": b.booking_id,
                "student_name": b.student_name,
                "course_title": b.course_title,
                "amount_due": b.amount_due,
                "status": b.status,
                "created_at": b.created_at,
            }
            for b in all_b
        ],
    }


@app.get("/admin/emails")
async def list_emails(limit: int = 20, _=Depends(require_admin)):
    """Return recent email logs for admin dashboard."""
    try:
        from backend.services.email_logger import LOG_FILE

        if not os.path.exists(LOG_FILE):
            return {"emails": []}
        with open(LOG_FILE) as f:
            content = f.read()
        # Parse email blocks
        blocks = content.strip().split("=" * 60)
        emails = []
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            lines = block.split("\n")
            entry = {}
            for line in lines:
                if line.startswith("Timestamp:"):
                    entry["timestamp"] = line.replace("Timestamp:", "").strip()
                elif line.startswith("To:"):
                    entry["to"] = line.replace("To:", "").strip()
                elif line.startswith("Subject:"):
                    entry["subject"] = line.replace("Subject:", "").strip()
            if entry:
                emails.append(entry)
        emails.reverse()
        return {"emails": emails[:limit]}
    except Exception as e:
        log.warning("Failed to read email log: %s", e)
        return {"emails": [], "error": str(e)}


@app.get("/admin/sessions")
async def list_sessions(limit: int = 50, _=Depends(require_admin)):
    """Return recent chat sessions for admin dashboard."""
    try:
        from backend.db.sqlite_setup import ChatSession, get_session

        db = get_session()
        try:
            sessions = (
                db.query(ChatSession)
                .order_by(ChatSession.created_at.desc())
                .limit(limit)
                .all()
            )
            return {
                "sessions": [
                    {
                        "session_id": s.session_id,
                        "role": s.role,
                        "content_preview": s.content[:100] if s.content else "",
                        "created_at": s.created_at.isoformat()
                        if hasattr(s.created_at, "isoformat")
                        else str(s.created_at),
                    }
                    for s in sessions
                ]
            }
        finally:
            db.close()
    except Exception as e:
        log.warning("Failed to query chat sessions: %s", e)
        return {"sessions": [], "error": str(e)}


# ── WebSocket Voice Endpoint ──────────────────────────────────

GREETING = (
    "Hi there! Welcome to DevNest Academy. I'm Nova, your AI admissions assistant. "
    "I can help you explore our courses, learn about pricing and scholarships, "
    "and guide you through the admission process. How can I help you today?"
)


@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    await websocket.accept()
    log.info("WebSocket client connected")

    # Generate a session ID for this WebSocket connection
    ws_session_id = uuid.uuid4().hex[:12]
    log.info("WebSocket session ID: %s", ws_session_id)

    if agent_executor is None:
        await websocket.send_json({"type": "error", "text": "Agent not initialised"})
        await websocket.close()
        return

    # ── Send greeting to new client ──
    await websocket.send_json({"type": "agent_reply", "text": GREETING})
    greeting_audio = await synthesize_speech(GREETING)
    if greeting_audio:
        await websocket.send_bytes(greeting_audio)

    try:
        while True:
            # Accept both binary (audio) and text (JSON) messages
            message = await websocket.receive()

            text_input: str = ""

            if "bytes" in message and message["bytes"]:
                # ── Audio input ──
                audio_bytes = message["bytes"]
                log.info("Received %d audio bytes", len(audio_bytes))

                await websocket.send_json({"type": "status", "text": "transcribing"})

                transcript = await transcribe_audio(audio_bytes)
                if not transcript:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "text": "Could not transcribe audio. Please try again.",
                        }
                    )
                    continue

                # Send transcript back so the UI can show what was heard
                await websocket.send_json({"type": "transcript", "text": transcript})
                log.info("Transcribed: %s", transcript)
                text_input = transcript

            elif "text" in message and message["text"]:
                # ── Text input ──
                try:
                    data = json.loads(message["text"])
                    if data.get("type") == "text":
                        text_input = data.get("text", "").strip()
                        log.info("Received text: %s", text_input)
                except json.JSONDecodeError:
                    log.warning("Unparseable text message: %s", message["text"][:100])
                    continue

            if not text_input:
                await websocket.send_json(
                    {
                        "type": "error",
                        "text": "No input received. Please try again.",
                    }
                )
                continue

            # ── Agent: run the question through Nova ──
            await websocket.send_json({"type": "status", "text": "thinking"})

            # Save WebSocket conversation to session history
            try:
                from backend.db.sqlite_setup import ChatSession, get_session

                db_ws = get_session()
                db_ws.add(
                    ChatSession(
                        session_id=ws_session_id, role="user", content=text_input
                    )
                )
                db_ws.commit()
                db_ws.close()
            except Exception as e:
                log.warning("Failed to save WS user message: %s", e, exc_info=True)
                try:
                    import sentry_sdk
                    sentry_sdk.capture_exception(e)
                except ImportError:
                    pass

            # Run agent with timeout
            try:
                result = await asyncio.wait_for(
                    run_agent(text_input, agent_executor, session_id=ws_session_id, user=None),
                    timeout=AGENT_TIMEOUT,
                )
            except asyncio.TimeoutError:
                log.warning("WS agent timed out")
                await websocket.send_json(
                    {
                        "type": "error",
                        "text": "I'm taking too long to respond. Please try again.",
                    }
                )
                continue
            except Exception as e:
                log.error("WS agent error: %s", e, exc_info=True)
                try:
                    import sentry_sdk
                    sentry_sdk.capture_exception(e)
                except ImportError:
                    pass
                await websocket.send_json(
                    {
                        "type": "error",
                        "text": "Something went wrong. Please try again.",
                    }
                )
                continue

            answer = result["response"]
            log.info("Nova answered: %.100s...", answer)

            try:
                db_ws2 = get_session()
                db_ws2.add(
                    ChatSession(
                        session_id=ws_session_id, role="ai", content=answer
                    )
                )
                db_ws2.commit()
                db_ws2.close()
            except Exception as e:
                log.warning("Failed to save WS AI message: %s", e, exc_info=True)
                try:
                    import sentry_sdk
                    sentry_sdk.capture_exception(e)
                except ImportError:
                    pass

            # Log email if booking was created
            if result["booking_created"] and result["booking_details"]:
                log_email(
                    to=result["booking_details"]["email"],
                    subject=f"Enrollment Confirmed — {result['booking_details']['course_title']}",
                    body=f"Dear {result['booking_details']['student_name']},\n\n"
                    f"Your enrollment in {result['booking_details']['course_title']} is confirmed!\n"
                    f"Booking ID: {result['booking_details']['booking_id']}\n"
                    f"Amount Due: ${result['booking_details']['amount_due']:.2f}\n"
                    f"Payment Option: {result['booking_details']['payment_option']}\n\n"
                    f"Welcome to DevNest Academy!\n"
                    f"The Nova Team",
                )

            # Include booking info in the reply if a booking was created
            reply_msg = {"type": "agent_reply", "text": answer}
            if result["booking_created"]:
                reply_msg["booking_created"] = True
                reply_msg["booking_id"] = result["booking_id"]
                reply_msg["booking_details"] = result["booking_details"]
            await websocket.send_json(reply_msg)

            # ── TTS: convert answer to speech ──
            await websocket.send_json({"type": "status", "text": "speaking"})

            audio_response = await synthesize_speech(answer)

            # Send the audio bytes
            if audio_response:
                await websocket.send_bytes(audio_response)
            else:
                log.warning("No TTS audio generated")

    except WebSocketDisconnect:
        log.info("WebSocket client disconnected")
    except Exception as e:
        log.error("WebSocket error: %s", e, exc_info=True)
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(e)
        except ImportError:
            pass
        try:
            await websocket.send_json({"type": "error", "text": "Internal server error"})
        except Exception:
            pass  # WS already closed — ignore secondary failure


# ── SPA Catch-all (must be last — serves frontend static build) ──


if STATIC_DIR.exists():
    from fastapi.responses import HTMLResponse

    def _static_route(html_name: str):
        """Factory: captures html_name in closure so loop routing works correctly."""
        resolved = STATIC_DIR / html_name

        async def handler():
            return HTMLResponse(content=resolved.read_text(encoding="utf-8"))
        return handler

    STATIC_ROUTES: dict[str, str] = {
        "/chat": "chat.html",
        "/admin": "admin.html",
        "/login": "login.html",
        "/register": "register.html",
        "/cart": "cart.html",
        "/dashboard": "dashboard.html",
        "/voice": "voice.html",
    }

    for route_path, html_file in STATIC_ROUTES.items():
        full_path = STATIC_DIR / html_file
        if full_path.exists():
            app.get(route_path, response_class=HTMLResponse, include_in_schema=False)(
                _static_route(html_file)
            )

    @app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
    async def serve_fallback(full_path: str):
        """Fallback: serve {path}.html or 404."""
        candidate = STATIC_DIR / f"{full_path}.html"
        if candidate.exists():
            return HTMLResponse(content=candidate.read_text(encoding="utf-8"))
        fallback = STATIC_DIR / "404.html"
        if fallback.exists():
            return HTMLResponse(content=fallback.read_text(encoding="utf-8"), status_code=404)
        return HTMLResponse(content="<h1>404 — Not Found</h1>", status_code=404)
