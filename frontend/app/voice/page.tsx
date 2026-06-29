"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { VoiceClient } from "@/lib/voice-client";

type Status = "disconnected" | "connected" | "listening" | "thinking" | "speaking";

export default function VoicePage() {
  const [status, setStatus] = useState<Status>("disconnected");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const clientRef = useRef<VoiceClient | null>(null);

  const addMsg = useCallback((role: string, text: string) => {
    setMessages((prev) => [...prev, { role, text }]);
  }, []);

  const startVoice = useCallback(async () => {
    setError("");

    const client = new VoiceClient({
      onMessage: (data) => {
        setStatus("speaking");
        addMsg("ai", data.text);
        if (data.booking_created) {
          addMsg(
            "system",
            `✅ Booking created! ID: ${data.booking_id}`
          );
        }
      },
      onAudio: () => {
        setTimeout(() => {
          if (clientRef.current?.isConnected) {
            setStatus("listening");
          }
        }, 500);
      },
      onStatus: (s) => {
        if (s === "disconnected") setStatus("disconnected");
        else if (s === "connected") setStatus("connected");
        else if (s === "transcribing") setStatus("listening");
        else if (s === "thinking") setStatus("thinking");
        else if (s === "speaking") setStatus("speaking");
      },
      onError: (e) => {
        setError(e);
        setStatus("disconnected");
      },
      onTranscript: (data) => {
        setTranscript(data.text);
      },
    });

    clientRef.current = client;
    const ok = await client.connect();
    if (!ok) {
      setError("Failed to connect to voice server");
      return;
    }
    setStatus("connected");

    const micOk = await client.startMicrophone();
    if (!micOk) {
      setError("Microphone access denied. Please allow microphone access.");
      return;
    }
    setStatus("listening");
    addMsg("system", "🎤 Microphone active — speak now!");
  }, [addMsg]);

  const stopVoice = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setStatus("disconnected");
    setTranscript("");
  }, []);

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      addMsg("user", text.trim());

      if (clientRef.current?.isConnected) {
        clientRef.current.sendText(text.trim());
        setStatus("thinking");
      } else {
        // Fallback to REST
        try {
          setStatus("thinking");
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL!}/chat`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: text.trim(), session_id: "voice-demo" }),
            }
          );
          const data = await res.json();
          addMsg("ai", data.response);
          setStatus("disconnected");
        } catch (e: any) {
          setError(`Error: ${e.message}`);
          setStatus("disconnected");
        }
      }
    },
    [addMsg]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendTextMessage(textInput);
    setTextInput("");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex flex-col">
      {/* Header */}
      <header className="text-center pt-8 pb-4">
        <a href="/" className="text-sm text-brand-600 hover:underline block mb-2">
          ← Back to Home
        </a>
        <h1 className="text-2xl font-bold text-brand-900">Voice Demo</h1>
        <p className="text-sm text-gray-500">WebSocket voice pipeline with server TTS</p>
      </header>

      {/* Status bar */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <span
          className={`w-3 h-3 rounded-full ${
            status === "disconnected"
              ? "bg-gray-400"
              : status === "connected"
              ? "bg-blue-500"
              : status === "listening"
              ? "bg-green-500 animate-pulse"
              : status === "thinking"
              ? "bg-yellow-500"
              : "bg-brand-500"
          }`}
        />
        <span className="text-sm font-medium text-gray-700 capitalize">
          {status === "disconnected"
            ? "Disconnected"
            : status === "connected"
            ? "Connected"
            : status === "listening"
            ? transcript
              ? `Heard: "${transcript}"`
              : "Listening..."
            : status === "thinking"
            ? "Nova is thinking..."
            : "Nova is speaking..."}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 overflow-y-auto max-h-[50vh] space-y-3 mb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "bg-brand-600 text-white rounded-br-sm"
                  : m.role === "system"
                  ? "bg-gray-100 text-gray-600 italic rounded-bl-sm"
                  : "bg-white border border-brand-100 text-gray-800 rounded-bl-sm shadow-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {status === "listening" && transcript && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-brand-100 text-brand-800 rounded-br-sm opacity-70">
              <span className="text-sm italic">&ldquo;{transcript}&rdquo;</span>
              <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse ml-1 align-text-bottom" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <footer className="max-w-2xl w-full mx-auto px-4 pb-8">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2 mb-3 text-center">
            {error}
            <button className="ml-2 underline" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}

        {status === "disconnected" || status === "connected" ? (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={startVoice}
              className="px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-lg shadow-lg shadow-brand-500/30 transition-all duration-200 hover:shadow-xl"
            >
              🎤 Start Voice Conversation
            </button>
            <p className="text-xs text-gray-400">
              Requires microphone access. Chrome recommended.
            </p>
            <div className="flex items-center gap-3 w-full">
              <span className="flex-1 h-px bg-brand-200" />
              <span className="text-xs text-gray-400">OR type below</span>
              <span className="flex-1 h-px bg-brand-200" />
            </div>
            <form onSubmit={handleSubmit} className="w-full flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-brand-200 bg-white px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 shadow-sm"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="rounded-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white px-6 py-3 text-sm font-semibold shadow-md transition-all"
              >
                Send
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={stopVoice}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-all duration-200"
              aria-label="End conversation"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <p className="text-xs text-gray-400">Tap to end voice conversation</p>
            <form onSubmit={handleSubmit} className="w-full flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Or type instead..."
                className="flex-1 rounded-full border border-brand-200 bg-white px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 shadow-sm"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="rounded-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white px-6 py-3 text-sm font-semibold shadow-md transition-all"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </footer>
    </main>
  );
}
