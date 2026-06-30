"""Deepgram Speech-to-Text service.

Accepts raw audio bytes (webm/opus from browser MediaRecorder) and returns
a transcribed text string.

Uses the Deepgram SDK v7 AsyncDeepgramClient.
"""

import os
from typing import Optional

from deepgram import AsyncDeepgramClient
from backend.core.logging_config import get_logger

log = get_logger("stt")

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Send audio bytes to Deepgram for transcription.

    Args:
        audio_bytes: Raw audio data (webm/opus from MediaRecorder).
        mime_type: MIME type of the audio data (not used by SDK v7, kept for compat).

    Returns:
        Transcribed text string, or empty string on failure.
    """
    if not DEEPGRAM_API_KEY:
        log.warning("DEEPGRAM_API_KEY not set. Returning empty transcription.")
        return ""

    try:
        client = AsyncDeepgramClient(api_key=DEEPGRAM_API_KEY)

        response = await client.listen.v1.media.transcribe_file(
            request=audio_bytes,
            model="nova-2",
            language="en",
            punctuate=True,
            smart_format=True,
        )

        transcript = ""
        if response.results and response.results.channels:
            channel = response.results.channels[0]
            if channel.alternatives and channel.alternatives[0].transcript:
                transcript = channel.alternatives[0].transcript

        return transcript.strip()

    except Exception as e:
        log.error("Deepgram STT error: %s", e, exc_info=True)
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(e)
        except ImportError:
            pass
        return ""
