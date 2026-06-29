"""Environment variable validation on startup.

Ensures critical configuration is present before the application starts.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path)

REQUIRED_IF_DEV = {
    "JWT_SECRET": "JWT secret key for token signing",
}

REQUIRED_IF_FEATURE = {
    "GROQ_API_KEY": "LLM API (Groq) — needed for chat/agent",
    "GEMINI_API_KEY": "LLM API (Gemini fallback) — needed for chat/agent",
    "DEEPGRAM_API_KEY": "Speech-to-text — needed for voice features",
    "ELEVENLABS_API_KEY": "Text-to-speech — needed for voice features",
}


def validate_env(exit_on_fail: bool = True) -> bool:
    """Check that required environment variables are set.

    Returns True if all checks pass, False otherwise.
    """
    errors: list[str] = []
    env = os.getenv("ENVIRONMENT", "development")

    # Always required
    secret = os.getenv("JWT_SECRET", "")
    if not secret or secret == "change-this-to-a-random-secret-in-production":
        errors.append("JWT_SECRET must be set to a secure random value")

    # At least one LLM key
    if not os.getenv("GROQ_API_KEY") and not os.getenv("GEMINI_API_KEY"):
        errors.append(
            "At least one LLM key required: set GROQ_API_KEY or GEMINI_API_KEY"
        )

    if errors:
        print("=" * 60, file=sys.stderr)
        print("  ENVIRONMENT VALIDATION FAILED", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        for err in errors:
            print(f"  ✗  {err}", file=sys.stderr)
        print(file=sys.stderr)
        print("  Create or update backend/.env with the required values.", file=sys.stderr)
        print("  See backend/.env.example for a template.", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        if exit_on_fail:
            sys.exit(1)
        return False

    print("✓ Environment validation passed")
    return True
