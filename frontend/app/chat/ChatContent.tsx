"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { sendChat, enrollCourse, type EnrollPayload, type ChatResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Message = { role: "user" | "ai"; text: string; fn?: string; booking?: boolean };
type Status = "idle" | "listening" | "thinking" | "speaking";

const SILENCE_TIMEOUT = 2500;

const FEE_SUGGESTIONS = [
  "What are your course fees?",
  "Compare all course pricing",
  "Tell me about scholarships",
  "Installment plans?",
  "Full-Stack Web Dev fee details",
  "Early bird discount?",
];

const ENROLL_SUGGESTION = "I want to enroll in a course";

const FEE_KEYWORDS = ["fee", "pricing", "installment", "scholarship", "early bird", "discount", "tuition", "$", "cost", "price", "pay", "upfront", "refund", "subscription"];

const COURSE_OPTIONS = [
  { slug: "fullstack-web-bootcamp", title: "Full-Stack Web Development Bootcamp" },
  { slug: "data-science-masterclass", title: "Data Science Masterclass" },
  { slug: "aiml-engineering", title: "AI/ML Engineering Program" },
  { slug: "uiux-design", title: "UI/UX Design Certificate" },
  { slug: "devops-cloud", title: "DevOps & Cloud Engineering" },
];

const PAYMENT_OPTIONS = [
  { value: "discounted", label: "Discounted (best value)" },
  { value: "upfront", label: "Upfront (full price)" },
  { value: "early_bird", label: "Early Bird (save extra)" },
  { value: "installment", label: "Installment (down + monthly)" },
  { value: "scholarship", label: "Scholarship (with discount)" },
];

function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[*_#>|\\]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/([A-Z]{3,}-[A-Z0-9]+)/g, (m) => m.split("").join(" "))
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function VoicePage() {
  const [sessionId] = useState(() => uuidv4());
  const { user, token } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [error, setError] = useState("");
  const [textInput, setTextInput] = useState("");
  const [audioActivity, setAudioActivity] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [lastBooking, setLastBooking] = useState<ChatResponse["booking_details"] | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    student_name: "",
    email: "",
    course_slug: "fullstack-web-bootcamp",
    payment_option: "discounted",
  });
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  const isCallActiveRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef("");
  const latestInterimRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listeningCountRef = useRef(0);

  const setStatusSync = (s: Status) => { statusRef.current = s; setStatus(s); };
  const setCallActive = (v: boolean) => { isCallActiveRef.current = v; setIsCallActive(v); };

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  };

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => { synthRef.current?.cancel(); clearSilenceTimer(); };
  }, []);

  useEffect(() => {
    if (transcriptRef.current)
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    synthRef.current?.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.9; utter.pitch = 1.0; utter.volume = 1;
    const trySpeak = () => {
      const voices = synthRef.current?.getVoices() ?? [];
      const preferred = voices.find(v =>
        v.lang.startsWith("en") && (
          v.name.includes("Google UK English Male") ||
          v.name.includes("Samantha") ||
          v.name.includes("Microsoft") ||
          v.name.includes("Google")
        )
      ) || voices.find(v => v.lang.startsWith("en"));
      if (preferred) utter.voice = preferred;
      utter.onend = () => { onEnd?.(); };
      utter.onerror = () => { onEnd?.(); };
      synthRef.current?.speak(utter);
    };
    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.onvoiceschanged = () => { speechSynthesis.onvoiceschanged = null; trySpeak(); };
    } else {
      trySpeak();
    }
  }, []);

  const processMessage = useCallback(async (text: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setStatusSync("thinking");
    setMessages(prev => [...prev, { role: "user", text }]);
    setError("");
    try {
      const res = await sendChat(text, sessionId, signal, token);
      const { response, function_called, booking_created, booking_id, booking_details } = res.data;
      const aiText = response || "I'm sorry, I didn't catch that. Could you please repeat?";

      if (booking_created && booking_details) {
        setLastBooking(booking_details);
        setShowBookingForm(false);
      }
      setMessages(prev => [...prev, { role: "ai", text: aiText, fn: function_called ?? undefined, booking: booking_created }]);
      setStatusSync("speaking");
      speak(cleanForSpeech(aiText), () => {
        if (isCallActiveRef.current) {
          setStatusSync("listening");
          startListening();
        } else {
          setStatusSync("idle");
        }
      });
    } catch (e: any) {
      if ((e as any)?.code === "ERR_CANCELED") return;
      const detail = e?.response?.data?.detail || e?.message || "Connection error";
      setError(`Error: ${detail}`);
      setStatusSync("idle");
    }
  }, [sessionId, speak, token]);

  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition not supported. Please use Chrome.");
      return;
    }
    if (statusRef.current === "listening") return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    accumulatedRef.current = "";
    listeningCountRef.current = 0; // reset restart-safety counter on successful start

    rec.onresult = (e: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        const transcriptPiece = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += transcriptPiece;
        } else {
          interimTranscript += transcriptPiece;
        }
      }

      const displayText = `${finalTranscript}${interimTranscript}`.trim();
      setTranscript(displayText);
      setAudioActivity(!!displayText);
      latestInterimRef.current = interimTranscript.trim();
      accumulatedRef.current = finalTranscript.trim();

      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        let spoken = accumulatedRef.current.trim();
        if (!spoken) spoken = latestInterimRef.current;

        if (spoken && statusRef.current === "listening") {
          rec.stop();
          setTranscript("");
          accumulatedRef.current = "";
          latestInterimRef.current = "";
          processMessage(spoken);
        }
      }, SILENCE_TIMEOUT);
    };

    rec.onerror = (e: any) => {
      if (e.error === "no-speech") return;
      if (e.error === "not-allowed") {
        setError("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
        setStatusSync("idle");
        setCallActive(false);
        return;
      }
      if (e.error !== "aborted") {
        setError(`Microphone error: ${e.error}. Try checking your mic or refreshing the page.`);
      }
      setStatusSync("idle");
    };

    rec.onend = () => {
      clearSilenceTimer();
      if (isCallActiveRef.current && statusRef.current === "listening") {
        listeningCountRef.current += 1;
        if (listeningCountRef.current > 5) {
          setError("Microphone keeps restarting. Try refreshing or typing instead.");
          setStatusSync("idle");
          setCallActive(false);
          return;
        }
        setTimeout(() => {
          if (isCallActiveRef.current && statusRef.current === "listening") {
            startListening();
          }
        }, 300);
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setStatusSync("listening");
  }, [processMessage]);

  const startCall = () => {
    setCallActive(true);
    setMessages([]);
    setError("");
    const greeting = "Hi there! Welcome to DevNest Academy. I'm Nova, your AI admissions assistant. I can help you explore our courses, learn about pricing and scholarships, and guide you through the admission process. How can I help you today?";
    setMessages([{ role: "ai", text: greeting }]);
    setStatusSync("speaking");
    speak(cleanForSpeech(greeting), () => {
      setStatusSync("listening");
      startListening();
    });
  };

  const endCall = () => {
    clearSilenceTimer();
    abortRef.current?.abort();
    abortRef.current = null;
    recognitionRef.current?.stop();
    synthRef.current?.cancel();
    setCallActive(false);
    setStatusSync("idle");
    setAudioActivity(false);
    setTranscript("");
    accumulatedRef.current = "";
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = textInput.trim();
    if (!text) return;
    setTextInput("");

    if (!isCallActiveRef.current) {
      setCallActive(true);
      setError("");
      processMessage(text);
      return;
    } else {
      if (statusRef.current === "listening") {
        recognitionRef.current?.stop();
      }
      synthRef.current?.cancel();
      processMessage(text);
    }
  };

  const handleMicClick = () => {
    if (statusRef.current === "listening") {
      clearSilenceTimer();
      recognitionRef.current?.stop();
      setAudioActivity(false);
      setStatusSync("idle");
    } else {
      synthRef.current?.cancel();
      startListening();
    }
  };

  const isFeeRelated = useCallback((text: string): boolean => {
    return FEE_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    if (statusRef.current === "thinking") {
      setTextInput(suggestion);
      return;
    }
    const text = suggestion.trim();
    if (!text) return;
    setTextInput("");
    if (statusRef.current === "listening") {
      recognitionRef.current?.stop();
    }
    synthRef.current?.cancel();
    processMessage(text);
  }, [processMessage]);

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollForm.student_name.trim() || !enrollForm.email.trim()) return;
    setEnrolling(true);
    setEnrollSuccess(null);
    try {
      const res = await enrollCourse({
        student_name: enrollForm.student_name.trim(),
        email: enrollForm.email.trim(),
        course_slug: enrollForm.course_slug,
        payment_option: enrollForm.payment_option,
      }, token);
      setLastBooking({
        booking_id: res.booking_id,
        student_name: res.student_name,
        email: res.email,
        course_title: res.course_title,
        amount_due: res.amount_due,
        payment_option: res.payment_option,
        status: res.status,
      });
      setEnrollSuccess(res.message);
      setShowBookingForm(false);
      setMessages(prev => [...prev, {
        role: "ai",
        text: res.message,
        booking: true,
      }]);
    } catch (err: any) {
      setError(`Enrollment failed: ${err.message}`);
    } finally {
      setEnrolling(false);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case "listening": return { label: "Listening...", ring: "ring-brand-300 animate-pulse" };
      case "thinking": return { label: "Thinking...", ring: "ring-brand-300 animate-breathe" };
      case "speaking": return { label: "Speaking...", ring: "ring-green-300 animate-pulse-slow" };
      default: return { label: "Click mic to speak", ring: "ring-brand-200" };
    }
  };

  return (
    <main className="flex flex-col items-center justify-between min-h-screen px-3 sm:p-8 bg-white">
      {/* Header */}
      <header className="text-center pt-3 sm:pt-0">
        <h1 className="text-xl sm:text-4xl font-bold text-brand-900 mb-0.5 sm:mb-2">
          DevNest Academy
        </h1>
        <p className="text-sm sm:text-lg text-brand-600 font-medium">
          Nova — AI Admissions Assistant
        </p>
      </header>

      {/* Chat Area */}
      <section className="flex-1 w-full max-w-2xl overflow-y-auto my-3 sm:my-6 px-0 sm:px-2">
        <div ref={transcriptRef} className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-hide pr-1 sm:pr-2">
          <AnimatePresence>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} mb-3`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    m.role === "user"
                      ? "bg-brand-600 text-white rounded-br-sm"
                      : "bg-white border border-brand-100 text-gray-800 rounded-bl-sm shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${m.role === "user" ? "text-brand-200" : "text-brand-500"}`}>
                      {m.role === "user" ? "You" : "Nova"}
                    </span>
                    {m.fn && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                        {m.fn}
                      </span>
                    )}
                    {m.booking && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        ✅ Enrolled
                      </span>
                    )}
                    {m.role === "ai" && !m.booking && isFeeRelated(m.text) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        💰 Fees
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Live interim transcription */}
          {isCallActive && transcript && (
            <div className="flex justify-end mb-3">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-brand-100 text-brand-800 rounded-br-sm opacity-70">
                <p className="text-sm leading-relaxed italic">
                  &ldquo;{transcript}&rdquo;
                  <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse ml-1 align-text-bottom" />
                </p>
              </div>
            </div>
          )}

          {messages.length === 0 && !isCallActive && (
            <div className="flex flex-col items-center justify-center min-h-[24rem] text-gray-400 text-sm">
              <div className="text-6xl mb-4 text-brand-300">🦉</div>
              <p className="text-gray-500 text-base font-medium">Ask Nova about DevNest Academy</p>
              <p className="text-xs mt-1">Courses · Fees · Scholarships · Admissions</p>

              {/* Suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-md">
                {FEE_SUGGESTIONS.slice(0, 4).map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSuggestionClick(s)}
                    className="px-4 py-2 rounded-xl bg-brand-50 hover:bg-brand-100
                               text-brand-700 text-sm font-medium
                               border border-brand-200 hover:border-brand-300
                               transition-all duration-200 shadow-sm"
                  >
                    {s}
                  </motion.button>
                ))}
              </div>

              <p className="text-xs mt-6 text-gray-400">
                Type below or tap &ldquo;Start Talking&rdquo; to use your voice
              </p>
            </div>
          )}

          {/* Suggestion chips after messages (idle) */}
          {messages.length > 0 && !isCallActive && status === "idle" && (
            <div className="flex flex-wrap gap-2 mt-4 pb-2">
              {[...(user ? [ENROLL_SUGGESTION] : []), ...FEE_SUGGESTIONS].filter(
                s => !messages.some(m => m.text.includes(s.split(" ").slice(0, 2).join(" ")))
              ).slice(0, 4).map((s, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleSuggestionClick(s)}
                  className="px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100
                             text-brand-600 text-xs font-medium
                             border border-brand-200 hover:border-brand-300
                             transition-all duration-200"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          )}

          {/* ── Booking Confirmation Card ── */}
          {lastBooking && status === "idle" && !isCallActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50
                         border border-green-200 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">✅</span>
                <span className="font-bold text-green-800 text-sm">Enrollment Confirmed</span>
              </div>
              <div className="text-xs text-green-700 space-y-1">
                <p><strong>Booking ID:</strong> {lastBooking.booking_id}</p>
                <p><strong>Student:</strong> {lastBooking.student_name}</p>
                <p><strong>Course:</strong> {lastBooking.course_title}</p>
                <p><strong>Amount:</strong> ${lastBooking.amount_due.toLocaleString()}</p>
                <p><strong>Payment:</strong> {lastBooking.payment_option.replace("_", " ")}</p>
                <p><strong>Status:</strong> {lastBooking.status}</p>
              </div>
              <button
                onClick={() => setLastBooking(null)}
                className="mt-3 text-xs text-green-600 hover:text-green-800 underline"
              >
                Dismiss
              </button>
            </motion.div>
          )}

          {/* ── Booking Form (logged-in only) ── */}
          {user && showBookingForm && !isCallActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-5 rounded-2xl bg-white border border-brand-200 shadow-md"
            >
              <h3 className="font-bold text-brand-800 text-sm mb-1">Enroll in a Course</h3>
              <p className="text-xs text-gray-500 mb-4">Fill in your details to enroll directly.</p>
              <form onSubmit={handleEnrollSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={enrollForm.student_name}
                    onChange={e => setEnrollForm(f => ({ ...f, student_name: e.target.value }))}
                    placeholder="e.g. John Doe"
                    className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={enrollForm.email}
                    onChange={e => setEnrollForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="e.g. john@example.com"
                    className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
                  <select
                    value={enrollForm.course_slug}
                    onChange={e => setEnrollForm(f => ({ ...f, course_slug: e.target.value }))}
                    className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-300"
                  >
                    {COURSE_OPTIONS.map(c => (
                      <option key={c.slug} value={c.slug}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Payment Option</label>
                  <select
                    value={enrollForm.payment_option}
                    onChange={e => setEnrollForm(f => ({ ...f, payment_option: e.target.value }))}
                    className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-300"
                  >
                    {PAYMENT_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={enrolling}
                    className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300
                               text-white text-sm font-bold py-2.5 rounded-lg
                               transition-all duration-200"
                  >
                    {enrolling ? "Enrolling..." : "Confirm Enrollment"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBookingForm(false)}
                    className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700
                               border border-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-2 mb-2 max-w-md text-center">
          {error}
          <button className="ml-2 underline text-red-600" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {/* Text input + Controls */}
      <footer className="flex flex-col items-center gap-2 sm:gap-3 pb-2 sm:pb-4 w-full max-w-2xl">
        {/* Text input bar */}
        <form onSubmit={handleTextSubmit} className="w-full">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message... (or use the mic)"
              disabled={status === "thinking"}
              className="flex-1 rounded-full border border-brand-200 bg-white px-4 sm:px-5 py-2.5 sm:py-3 text-sm
                         text-gray-800 placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200 shadow-sm"
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={!textInput.trim() || status === "thinking"}
              className="rounded-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300
                         text-white w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center
                         transition-all duration-200 shadow-md flex-shrink-0"
              aria-label="Send message"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </motion.button>
          </div>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-2 sm:gap-3 w-full">
          <span className="flex-1 h-px bg-brand-100" />
          <span className="text-xs text-gray-400 font-medium">OR</span>
          <span className="flex-1 h-px bg-brand-100" />
        </div>

        {!isCallActive ? (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={startCall}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-base sm:text-lg shadow-lg shadow-brand-500/30 transition-all duration-200"
            >
              Start Talking
            </motion.button>
            {user && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => { setShowBookingForm(true); setError(""); }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white text-brand-600 text-sm font-medium
                           border border-brand-200 hover:border-brand-300 hover:bg-brand-50
                           transition-all duration-200 shadow-sm"
              >
                Enroll Now
              </motion.button>
            )}
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Ask me about courses, fees, scholarships, or admissions.
            </p>
          </>
        ) : (
          <>
            {/* Status badge */}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-brand-600">
              {status === "listening" && audioActivity && (
                <span className="flex items-center gap-0.5 h-4">
                  <span className="w-0.5 bg-brand-500 rounded-full h-2 animate-pulse" />
                  <span className="w-0.5 bg-brand-500 rounded-full h-3 animate-pulse" style={{ animationDelay: "0.15s" }} />
                  <span className="w-0.5 bg-brand-500 rounded-full h-4 animate-pulse" style={{ animationDelay: "0.3s" }} />
                  <span className="w-0.5 bg-brand-500 rounded-full h-3 animate-pulse" style={{ animationDelay: "0.15s" }} />
                  <span className="w-0.5 bg-brand-500 rounded-full h-2 animate-pulse" />
                </span>
              )}
              {getStatusConfig().label}
            </div>

            {/* Mic + End buttons */}
            <div className="flex items-center gap-4 sm:gap-6">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleMicClick}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300
                  ${status === "listening"
                    ? "bg-red-500 hover:bg-red-600 ring-4 ring-red-300 animate-pulse shadow-lg shadow-red-500/30"
                    : status === "thinking"
                      ? "bg-brand-500 ring-4 ring-brand-300"
                      : "bg-brand-600 hover:bg-brand-700 ring-4 ring-brand-200"
                  }`}
                aria-label={status === "listening" ? "Stop recording" : "Start recording"}
                disabled={status === "thinking"}
              >
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {status === "thinking" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  ) : status === "listening" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8" />
                  )}
                </svg>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={endCall}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all duration-200"
                aria-label="End call"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </motion.button>
            </div>
          </>
        )}
      </footer>
    </main>
  );
}
