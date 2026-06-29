"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

type Booking = {
  booking_id: string;
  student_name: string;
  email: string;
  course_title: string;
  amount_due: number;
  payment_option: string;
  status: string;
  created_at: string;
};

type EmailEntry = {
  timestamp: string;
  to: string;
  subject: string;
};

type SessionEntry = {
  session_id: string;
  role: string;
  content_preview: string;
  created_at: string;
};

type Course = {
  id: number;
  slug: string;
  title: string;
  level: string;
  duration_weeks: number;
  price_usd: number;
  discounted_price: number | null;
  next_cohort_start: string | null;
  short_description: string;
  enrollment_open: boolean;
};

type Instructor = {
  id: number;
  name: string;
  title: string;
  bio: string;
  expertise: string;
  linkedin_url: string;
  avatar_url: string;
  is_active: boolean;
};

type User = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

type Tab = "bookings" | "emails" | "sessions" | "courses" | "instructors" | "users";

const BASE = process.env.NEXT_PUBLIC_API_URL!;

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/* ── Modal Component ── */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, token, logout, isAdmin } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  // Course form state
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    slug: "", title: "", level: "Beginner", duration_weeks: 8,
    price_usd: 0, discounted_price: "", next_cohort_start: "",
    short_description: "", enrollment_open: true,
  });

  // Instructor form state
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [instructorForm, setInstructorForm] = useState({
    name: "", title: "", bio: "", expertise: "", linkedin_url: "", avatar_url: "",
  });

  const getHeaders = useCallback(() => {
    if (!token) return { "Content-Type": "application/json" } as Record<string, string>;
    return authHeaders(token);
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      switch (tab) {
        case "bookings": {
          const res = await fetch(`${BASE}/admin/bookings`, { headers: getHeaders() });
          const data = await res.json();
          setBookings(data.bookings || []);
          break;
        }
        case "emails": {
          const res = await fetch(`${BASE}/admin/emails`, { headers: getHeaders() });
          const data = await res.json();
          setEmails(data.emails || []);
          break;
        }
        case "sessions": {
          const res = await fetch(`${BASE}/admin/sessions`, { headers: getHeaders() });
          const data = await res.json();
          setSessions(data.sessions || []);
          break;
        }
        case "courses": {
          const res = await fetch(`${BASE}/admin/courses`, { headers: getHeaders() });
          const data = await res.json();
          setCourses(data.courses || []);
          break;
        }
        case "instructors": {
          const res = await fetch(`${BASE}/admin/instructors`, { headers: getHeaders() });
          const data = await res.json();
          setInstructors(data.instructors || []);
          break;
        }
        case "users": {
          const res = await fetch(`${BASE}/admin/users`, { headers: getHeaders() });
          const data = await res.json();
          setUsers(data.users || []);
          break;
        }
      }
    } catch (e: any) {
      setError(`Failed to load data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [tab, token, getHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancel = async (bookingId: string) => {
    setCancelling(bookingId);
    setFeedback("");
    try {
      const res = await fetch(`${BASE}/bookings/${bookingId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`✅ ${data.message}`);
        fetchData();
      } else {
        setFeedback(`❌ ${data.detail || "Cancel failed"}`);
      }
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally {
      setCancelling(null);
    }
  };

  /* ── Course CRUD ── */
  const resetCourseForm = () => {
    setEditingCourse(null);
    setCourseForm({
      slug: "", title: "", level: "Beginner", duration_weeks: 8,
      price_usd: 0, discounted_price: "", next_cohort_start: "",
      short_description: "", enrollment_open: true,
    });
  };

  const openEditCourse = (c: Course) => {
    setEditingCourse(c);
    setCourseForm({
      slug: c.slug, title: c.title, level: c.level,
      duration_weeks: c.duration_weeks, price_usd: c.price_usd,
      discounted_price: c.discounted_price?.toString() || "",
      next_cohort_start: c.next_cohort_start || "",
      short_description: c.short_description,
      enrollment_open: c.enrollment_open,
    });
    setShowCourseForm(true);
  };

  const saveCourse = async () => {
    setFeedback("");
    try {
      const body: any = { ...courseForm };
      if (courseForm.discounted_price) {
        body.discounted_price = parseFloat(courseForm.discounted_price);
      } else {
        body.discounted_price = null;
      }
      delete (body as any).discounted_price_raw;

      const url = editingCourse
        ? `${BASE}/admin/courses/${editingCourse.id}`
        : `${BASE}/admin/courses`;
      const method = editingCourse ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`✅ ${data.message}`);
        setShowCourseForm(false);
        resetCourseForm();
        fetchData();
      } else {
        setFeedback(`❌ ${data.detail || "Failed to save course"}`);
      }
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    }
  };

  const deleteCourse = async (id: number) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    setFeedback("");
    try {
      const res = await fetch(`${BASE}/admin/courses/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`✅ ${data.message}`);
        fetchData();
      } else {
        setFeedback(`❌ ${data.detail || "Failed to delete course"}`);
      }
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    }
  };

  /* ── Instructor CRUD ── */
  const resetInstructorForm = () => {
    setEditingInstructor(null);
    setInstructorForm({
      name: "", title: "", bio: "", expertise: "", linkedin_url: "", avatar_url: "",
    });
  };

  const openEditInstructor = (inst: Instructor) => {
    setEditingInstructor(inst);
    setInstructorForm({
      name: inst.name, title: inst.title, bio: inst.bio,
      expertise: inst.expertise, linkedin_url: inst.linkedin_url,
      avatar_url: inst.avatar_url,
    });
    setShowInstructorForm(true);
  };

  const saveInstructor = async () => {
    setFeedback("");
    try {
      const url = editingInstructor
        ? `${BASE}/admin/instructors/${editingInstructor.id}`
        : `${BASE}/admin/instructors`;
      const method = editingInstructor ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(instructorForm),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`✅ ${data.message}`);
        setShowInstructorForm(false);
        resetInstructorForm();
        fetchData();
      } else {
        setFeedback(`❌ ${data.detail || "Failed to save instructor"}`);
      }
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    }
  };

  const deleteInstructor = async (id: number) => {
    if (!confirm("Are you sure you want to delete this instructor?")) return;
    setFeedback("");
    try {
      const res = await fetch(`${BASE}/admin/instructors/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`✅ ${data.message}`);
        fetchData();
      } else {
        setFeedback(`❌ ${data.detail || "Failed to delete instructor"}`);
      }
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "bookings", label: "Bookings" },
    { key: "courses", label: "Courses" },
    { key: "instructors", label: "Instructors" },
    { key: "users", label: "Users" },
    { key: "emails", label: "Email Log" },
    { key: "sessions", label: "Chat Sessions" },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦉</span>
            <div>
              <h1 className="text-xl font-bold text-brand-900">Admin Dashboard</h1>
              {user && <p className="text-xs text-gray-500">{user.full_name} ({user.email})</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
            >
              🚪 Logout
            </button>
            <a
              href="/"
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
            >
              ← Back to Site
            </a>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Feedback banner */}
      {feedback && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${
            feedback.startsWith("✅") ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            <span>{feedback}</span>
            <button onClick={() => setFeedback("")} className="ml-2 opacity-60 hover:opacity-100">&times;</button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3 animate-pulse">🔄</div>
            <p>Loading {tab}...</p>
          </div>
        ) : (
          <>
            {/* ── Bookings Tab ── */}
            {tab === "bookings" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">All Bookings ({bookings.length})</h2>
                </div>
                {bookings.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                    <p className="text-4xl mb-2">📋</p>
                    <p>No bookings yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 text-left">
                          <th className="px-4 py-3 font-medium">Booking ID</th>
                          <th className="px-4 py-3 font-medium">Student</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Course</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Payment</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bookings.map((b) => (
                          <tr key={b.booking_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-brand-700">{b.booking_id}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{b.student_name}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{b.email}</td>
                            <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{b.course_title}</td>
                            <td className="px-4 py-3 font-medium">${b.amount_due?.toLocaleString()}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{b.payment_option}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                b.status === "confirmed"
                                  ? "bg-green-100 text-green-700"
                                  : b.status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}>
                                {b.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {b.created_at ? new Date(b.created_at).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="px-4 py-3">
                              {b.status === "confirmed" && (
                                <button
                                  onClick={() => handleCancel(b.booking_id)}
                                  disabled={cancelling === b.booking_id}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                                >
                                  {cancelling === b.booking_id ? "..." : "Cancel"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── Courses Tab ── */}
            {tab === "courses" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Course Catalog ({courses.length})</h2>
                  <button
                    onClick={() => { resetCourseForm(); setShowCourseForm(true); }}
                    className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
                  >
                    + Add Course
                  </button>
                </div>
                {courses.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                    <p>No courses found</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {courses.map((c) => (
                      <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-gray-800">{c.title}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            c.level === "Beginner" ? "bg-green-100 text-green-700"
                            : c.level === "Intermediate" ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                          }`}>{c.level}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Slug: {c.slug}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">💰 ${c.price_usd}</span>
                          {c.discounted_price && <span className="text-green-600">🔥 ${c.discounted_price}</span>}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          <span>⏱ {c.duration_weeks} weeks</span>
                          <span>📅 {c.next_cohort_start || "TBD"}</span>
                        </div>
                        {c.short_description && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{c.short_description}</p>
                        )}
                        <div className="flex items-center justify-between mt-3">
                          <span className={`text-xs font-medium ${c.enrollment_open ? "text-green-600" : "text-red-600"}`}>
                            {c.enrollment_open ? "✅ Open" : "❌ Closed"}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => openEditCourse(c)} className="text-xs text-brand-600 hover:underline">Edit</button>
                            <button onClick={() => deleteCourse(c.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Instructors Tab ── */}
            {tab === "instructors" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Instructors ({instructors.length})</h2>
                  <button
                    onClick={() => { resetInstructorForm(); setShowInstructorForm(true); }}
                    className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
                  >
                    + Add Instructor
                  </button>
                </div>
                {instructors.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                    <p className="text-4xl mb-2">👨‍🏫</p>
                    <p>No instructors yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {instructors.map((inst) => (
                      <div key={inst.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-lg font-bold text-brand-700">
                            {inst.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800">{inst.name}</h3>
                            <p className="text-xs text-gray-500">{inst.title}</p>
                          </div>
                        </div>
                        {inst.bio && <p className="text-xs text-gray-600 mb-2 line-clamp-2">{inst.bio}</p>}
                        {inst.expertise && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {inst.expertise.split(",").map((e, i) => (
                              <span key={i} className="px-2 py-0.5 bg-brand-50 text-brand-700 text-xs rounded-full">{e.trim()}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <span className={`text-xs font-medium ${inst.is_active ? "text-green-600" : "text-red-600"}`}>
                            {inst.is_active ? "Active" : "Inactive"}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => openEditInstructor(inst)} className="text-xs text-brand-600 hover:underline">Edit</button>
                            <button onClick={() => deleteInstructor(inst.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Users Tab ── */}
            {tab === "users" && (
              <>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Admin Users ({users.length})
                </h2>
                {users.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                    <p className="text-4xl mb-2">👤</p>
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 text-left">
                          <th className="px-4 py-3 font-medium">ID</th>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Role</th>
                          <th className="px-4 py-3 font-medium">Active</th>
                          <th className="px-4 py-3 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-xs text-gray-500">{u.id}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{u.full_name}</td>
                            <td className="px-4 py-3 text-gray-600">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                              }`}>{u.role}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${u.is_active ? "text-green-600" : "text-red-600"}`}>
                                {u.is_active ? "✅" : "❌"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── Email Log Tab ── */}
            {tab === "emails" && (
              <>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Email Log ({emails.length})
                </h2>
                {emails.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                    <p className="text-4xl mb-2">📧</p>
                    <p>No emails sent yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emails.map((e, i) => (
                      <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-brand-700">{e.subject}</span>
                          <span className="text-xs text-gray-400">{e.timestamp ? new Date(e.timestamp).toLocaleString() : "N/A"}</span>
                        </div>
                        <p className="text-xs text-gray-600">To: <strong>{e.to}</strong></p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Chat Sessions Tab ── */}
            {tab === "sessions" && (
              <>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Recent Chat Sessions ({sessions.length})
                </h2>
                {sessions.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                    <p className="text-4xl mb-2">💬</p>
                    <p>No chat sessions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 text-left">
                          <th className="px-4 py-3 font-medium">Session ID</th>
                          <th className="px-4 py-3 font-medium">Role</th>
                          <th className="px-4 py-3 font-medium">Message</th>
                          <th className="px-4 py-3 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sessions.map((s, i) => (
                          <tr key={i} className={`hover:bg-gray-50 transition-colors ${s.role === "user" ? "" : "bg-brand-50/30"}`}>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.session_id}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                s.role === "user" ? "bg-blue-100 text-blue-700" : "bg-brand-100 text-brand-700"
                              }`}>
                                {s.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 max-w-md truncate">{s.content_preview}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(s.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Course Form Modal ── */}
      {showCourseForm && (
        <Modal title={editingCourse ? "Edit Course" : "Add Course"} onClose={() => { setShowCourseForm(false); resetCourseForm(); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Slug</label>
              <input type="text" value={courseForm.slug} onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Level</label>
                <select value={courseForm.level} onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none">
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Duration (weeks)</label>
                <input type="number" value={courseForm.duration_weeks} onChange={(e) => setCourseForm({ ...courseForm, duration_weeks: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Price (USD)</label>
                <input type="number" step="0.01" value={courseForm.price_usd} onChange={(e) => setCourseForm({ ...courseForm, price_usd: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Discounted Price</label>
                <input type="number" step="0.01" value={courseForm.discounted_price} onChange={(e) => setCourseForm({ ...courseForm, discounted_price: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Next Cohort Start</label>
              <input type="text" value={courseForm.next_cohort_start} onChange={(e) => setCourseForm({ ...courseForm, next_cohort_start: e.target.value })}
                placeholder="e.g. July 14, 2026"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Short Description</label>
              <textarea value={courseForm.short_description} onChange={(e) => setCourseForm({ ...courseForm, short_description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="enrollment_open" checked={courseForm.enrollment_open}
                onChange={(e) => setCourseForm({ ...courseForm, enrollment_open: e.target.checked })}
                className="rounded border-gray-300" />
              <label htmlFor="enrollment_open" className="text-sm text-gray-700">Enrollment Open</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveCourse} className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors">
                {editingCourse ? "Update Course" : "Create Course"}
              </button>
              <button onClick={() => { setShowCourseForm(false); resetCourseForm(); }} className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Instructor Form Modal ── */}
      {showInstructorForm && (
        <Modal title={editingInstructor ? "Edit Instructor" : "Add Instructor"} onClose={() => { setShowInstructorForm(false); resetInstructorForm(); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={instructorForm.name} onChange={(e) => setInstructorForm({ ...instructorForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={instructorForm.title} onChange={(e) => setInstructorForm({ ...instructorForm, title: e.target.value })}
                placeholder="e.g. Senior Full-Stack Engineer"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bio</label>
              <textarea value={instructorForm.bio} onChange={(e) => setInstructorForm({ ...instructorForm, bio: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Expertise (comma-separated)</label>
              <input type="text" value={instructorForm.expertise} onChange={(e) => setInstructorForm({ ...instructorForm, expertise: e.target.value })}
                placeholder="e.g. React, Node.js, TypeScript"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">LinkedIn URL</label>
              <input type="text" value={instructorForm.linkedin_url} onChange={(e) => setInstructorForm({ ...instructorForm, linkedin_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Avatar URL</label>
              <input type="text" value={instructorForm.avatar_url} onChange={(e) => setInstructorForm({ ...instructorForm, avatar_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-brand-400 outline-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveInstructor} className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors">
                {editingInstructor ? "Update Instructor" : "Create Instructor"}
              </button>
              <button onClick={() => { setShowInstructorForm(false); resetInstructorForm(); }} className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
