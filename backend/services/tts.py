"""Text-to-Speech service.

Uses gTTS (Google Text-to-Speech) as the primary provider — free, no API key needed.
Falls back to ElevenLabs if a valid paid-plan API key is configured.
"""

import io
import os
from typing import Optional

from gtts import gTTS
from backend.core.logging_config import get_logger

log = get_logger("tts")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv(
    "ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"  # Rachel voice
)

# Maximum characters per TTS request (gTTS has no hard limit, but keep it sane)
MAX_CHARS = 500


async def synthesize_speech(text: str) -> Optional[bytes]:
    """Convert text to speech.

    Args:
        text: The text to speak (up to ~500 chars for gTTS).

    Returns:
        MP3 audio bytes, or None on failure.
    """
    if not text:
        return None

    # Truncate very long text to avoid timeouts
    text = text[:MAX_CHARS]

    # Try ElevenLabs first if API key is set (requires paid plan)
    if ELEVENLABS_API_KEY:
        result = await _synthesize_elevenlabs(text)
        if result:
            return result
        # Fall through to gTTS if ElevenLabs fails
        log.warning("ElevenLabs failed, falling back to gTTS")

    # gTTS — free, no API key required
    return await _synthesize_gtts(text)


async def _synthesize_gtts(text: str) -> Optional[bytes]:
    """Synthesize speech using Google Text-to-Speech (gTTS)."""
    try:
        tts = gTTS(text=text, lang="en", slow=False)
        buf = io.BytesIO()
        # gTTS.write_to_fp is synchronous and uses requests under the hood
        tts.write_to_fp(buf)
        buf.seek(0)
        audio_bytes = buf.read()
        log.info("gTTS generated %d bytes", len(audio_bytes))
        return audio_bytes
    except Exception as e:
        log.error("gTTS error: %s", e)
        return None


async def _synthesize_elevenlabs(text: str) -> Optional[bytes]:
    """Synthesize speech using ElevenLabs (requires paid plan for library voices)."""
    import httpx

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
    }
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.7,
            "optimize_streaming_latency": 1,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                log.info("ElevenLabs generated %d bytes", len(response.content))
                return response.content
            else:
                detail = response.json().get("detail", {})
                msg = detail.get("message", response.text[:100])
                log.error("ElevenLabs error (HTTP %d): %s", response.status_code, msg)
                return None
    except Exception as e:
        log.error("ElevenLabs request error: %s", e)
        return None
