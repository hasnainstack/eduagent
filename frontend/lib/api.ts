/** API client for the EduAgent backend. */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatResponse {
  response: string;
  function_called?: string | null;
  booking_created: boolean;
  booking_id?: string | null;
  booking_details?: {
    booking_id: string;
    student_name: string;
    email: string;
    course_title: string;
    amount_due: number;
    payment_option: string;
    status: string;
  } | null;
}

export interface EnrollPayload {
  student_name: string;
  email: string;
  course_slug: string;
  payment_option: string;
}

export interface EnrollResponse {
  booking_id: string;
  student_name: string;
  email: string;
  course_title: string;
  amount_due: number;
  payment_option: string;
  status: string;
  message: string;
}

export async function sendChat(
  text: string,
  sessionId: string,
  signal?: AbortSignal,
  token?: string | null,
): Promise<{ data: ChatResponse }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, session_id: sessionId }),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return { data: await res.json() };
}

export async function enrollCourse(
  payload: EnrollPayload,
  token?: string | null,
): Promise<EnrollResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/enroll`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return await res.json();
}
