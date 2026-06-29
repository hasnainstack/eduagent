# EduAgent — AI Voice Sales Assistant for DevNest Academy

A voice-powered AI sales assistant for **DevNest Academy**, an online tech school. Nova answers questions about courses, fees, scholarships, and admissions — via voice or text.

**Agent name:** Nova — a warm, knowledgeable admissions counselor.

---

## Tech Stack

| Layer      | Technology |
| ---------- | ---------- |
| Frontend   | Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, Framer Motion, Lucide React |
| Backend    | FastAPI (Python 3.10+), Uvicorn |
| Database   | SQLite + SQLAlchemy (NullPool for connection safety) |
| Auth       | JWT (PyJWT), bcrypt (passlib), HTTPBearer |
| LLM        | Groq **Llama 3.3-70b-versatile** (primary) — Gemini 2.0 Flash (fallback) |
| Voice IN   | Browser **Web Speech API** (SpeechRecognition) → sends text to backend |
| Voice OUT  | Browser **SpeechSynthesis API** (primary) |
| STT→Text   | Deepgram **nova-2** model (`/chat` endpoint, async) |
| TTS→Speech | **gTTS** (free, no key) primary — ElevenLabs (Rachel voice) fallback |
| Agent      | Custom prompt-based tool-calling (not LangChain `bind_tools`) |
| Error Monitoring | Sentry (optional) |
| Rate Limiting | SlowAPI |

---

## Project Structure

```
eduagent/
├── frontend/                          # Next.js 14 App Router
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (AuthProvider wrapper)
│   │   ├── page.tsx                   # Landing page — course cards, hero
│   │   ├── globals.css                # Tailwind + custom styles
│   │   ├── error.tsx                  # Global error boundary
│   │   ├── not-found.tsx              # 404 page
│   │   ├── robots.ts                  # SEO
│   │   ├── chat/
│   │   │   ├── page.tsx               # Chat page wrapper
│   │   │   └── ChatContent.tsx        # Voice/text chat component
│   │   ├── login/page.tsx             # Login form
│   │   ├── register/page.tsx          # Registration form
│   │   ├── cart/page.tsx              # Shopping cart
│   │   ├── dashboard/page.tsx         # User dashboard
│   │   ├── voice/page.tsx             # WebSocket voice demo
│   │   └── admin/
│   │       ├── page.tsx               # Admin panel (course mgmt)
│   │       ├── layout.tsx             # Admin layout
│   │       └── loading.tsx            # Admin loading state
│   ├── components/
│   │   └── AuthGuard.tsx              # Admin route guard
│   ├── lib/
│   │   ├── api.ts                     # API client (chat, enroll)
│   │   ├── auth-context.tsx           # JWT auth context + useAuth hook
│   │   └── voice-client.ts            # WebSocket voice client
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                           # FastAPI server
│   ├── main.py                        # REST + WebSocket endpoints
│   ├── agent/
│   │   ├── chain.py                   # NovaAgent — prompt-based tool-calling loop
│   │   ├── tools.py                   # 7 LangChain tools (built-in fallback data)
│   │   └── prompts.py                 # Nova system prompt (voice-optimized)
│   ├── auth/
│   │   ├── router.py                  # Login / Register / Me endpoints
│   │   ├── dependencies.py            # JWT dependency injection (get_current_user, get_optional_user)
│   │   ├── jwt_handler.py             # Token create + decode
│   │   └── schemas.py                 # Pydantic models
│   ├── services/
│   │   ├── stt.py                     # Deepgram transcription (nova-2)
│   │   ├── tts.py                     # gTTS (primary) + ElevenLabs (fallback)
│   │   ├── booking_store.py           # Booking CRUD (in-memory + SQLite)
│   │   ├── email_logger.py            # File-based email logging
│   │   └── embeddings.py              # sentence-transformers (legacy)
│   ├── db/
│   │   └── sqlite_setup.py            # SQLAlchemy models + session factory
│   ├── admin/
│   │   └── router.py                  # Admin-only endpoints
│   ├── user/
│   │   └── router.py                  # User profile endpoints
│   ├── core/
│   │   ├── env.py                     # Environment validation
│   │   └── logging_config.py          # Structured logging setup
│   ├── tests/
│   │   └── test_smoke.py              # Smoke tests
│   ├── static/                        # Next.js static export (auto-built)
│   │   ├── index.html, chat.html, login.html, ...
│   │   └── _next/static/              # Compiled JS/CSS assets
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── docs/
│   └── seed-postgres.sql              # Legacy PostgreSQL seed (unused)
├── scripts/
│   └── deploy.sh                      # Deploy script
├── tests/
│   └── test_backend.py                # Integration tests
├── docker-compose.yml                 # Legacy (unused — project uses SQLite)
├── Dockerfile                         # Root Dockerfile (multi-stage)
├── fly.toml                           # Fly.io config
├── render.yaml                        # Render.com config
├── Procfile                           # Heroku-style process
├── .gitignore
├── .dockerignore
└── README.md
```

---

## Quick Start (Local Development)

### 1. Set up environment variables

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

Required keys:

| Key | Purpose | Get it at |
| --- | ------- | --------- |
| `GROQ_API_KEY` | LLM (primary) — Llama 3.3-70b | console.groq.com |
| `GEMINI_API_KEY` | LLM fallback | aistudio.google.com |
| `DEEPGRAM_API_KEY` | Speech-to-text for voice | console.deepgram.com |
| `ELEVENLABS_API_KEY` | TTS fallback | elevenlabs.io |
| `JWT_SECRET` | Auth token signing | `openssl rand -hex 32` |

> **Note:** You only need `GROQ_API_KEY` or `GEMINI_API_KEY` (not both) for basic chat. Voice features also need `DEEPGRAM_API_KEY`.

### 2. Start the backend

```bash
cd eduagent
python3 -m uvicorn backend.main:app --reload --port 8000
```

The server starts on `http://localhost:8000`. The `/health` endpoint confirms everything is running.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you can type messages or tap **Start Talking** to use your voice.

---

## Voice Pipeline

```
User taps "Start Talking"
  → Browser SpeechRecognition listens (Web Speech API)
  → On silence (2.5s): sends transcript as text to POST /chat
  → FastAPI runs through Nova agent (Groq Llama 3.3-70b)
  → Agent may call tools (course search, fee lookup, booking)
  → Nova responds with text
  → Browser SpeechSynthesis speaks the answer aloud
  → Microphone re-opens for next question
```

For the WebSocket real-time voice flow (alternative):

```
User speaks into mic
  → Audio (webm) sent over WebSocket to /ws/voice
  → Deepgram STT transcribes → text
  → Nova agent processes → generates answer
  → gTTS / ElevenLabs converts answer to speech audio
  → Audio bytes sent back over WebSocket
  → Browser plays the response
```

---

## REST Endpoints

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/chat` | Optional | Send a message to Nova |
| POST | `/enroll` | **Required** | Direct enrollment (bypasses agent) |
| POST | `/auth/login` | — | Login, receive JWT |
| POST | `/auth/register` | — | Create account |
| GET | `/auth/me` | Required | Current user info |
| GET | `/api/courses` | — | List all courses |
| GET | `/health` | — | Health check |
| WS | `/ws/voice` | — | Real-time voice pipeline |
| POST | `/bookings/{id}/cancel` | Required | Cancel a booking |
| GET | `/bookings` | — | List all bookings (demo) |

---

## Agent Tools

Nova has 7 tools to answer questions:

| Tool | What it does |
| ---- | ------------ |
| `search_courses` | Match courses by keyword (title, level, topic) |
| `get_course_details` | Full course info — duration, modules, prerequisites |
| `search_faqs` | FAQ lookup — admissions, certificates, tech requirements |
| `get_pricing` | Subscription plans (Free, Starter, Pro, Pro Plus, Team) |
| `get_scholarships` | Discounts — South Asia Regional (40%), Women in Tech, Merit, Early Bird |
| `get_fee_structure` | Detailed fee breakdown — upfront, discounted, installment, early bird |
| `book_course` | Enroll a student (requires authentication) |

All tools have **built-in fallback data** — they work without any database connection.

---

## Architecture Decisions

- **Prompt-based tool calling** — The agent outputs raw JSON like `{"tool": "search_courses", "arguments": {...}}` which is parsed and executed. This is more reliable with Groq's Llama model than LangChain's native `bind_tools`.
- **SQLite + NullPool** — Avoids connection pool exhaustion under hot-reload during development. No external database dependency.
- **gTTS primary TTS** — Free, no API key. ElevenLabs falls back when gTTS fails.
- **Browser SpeechRecognition** — Client-side voice capture avoids streaming raw audio to the backend for basic chat, reducing latency.

---

## License

MIT — for educational and portfolio use.
