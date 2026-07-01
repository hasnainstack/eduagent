"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL!;

type Booking = {
  booking_id: string;
  student_name: string;
  course_title: string;
  course_slug: string;
  amount_due: number;
  payment_option: string;
  status: string;
  created_at: string | null;
};

export default function DashboardPage() {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    fetch(`${BASE}/user/my-bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setBookings(data.bookings || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [token, loading, router]);

  if (loading || fetching) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦉</div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="text-xl sm:text-2xl shrink-0">🦉</Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-brand-900 truncate">My Dashboard</h1>
              <p className="text-xs text-gray-500 truncate hidden sm:block">{user?.full_name} ({user?.email})</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link href="/cart" className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition-colors">
              🛒 Cart
            </Link>
            <Link href="/" className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
              <span className="hidden sm:inline">← Home</span>
              <span className="sm:hidden">🏠</span>
            </Link>
            <button
              onClick={() => { logout(); router.push("/"); }}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            >
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">🚪</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          My Courses ({bookings.length})
        </h2>

        {bookings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-gray-500 mb-4">You haven&apos;t enrolled in any courses yet</p>
            <Link
              href="/#courses"
              className="inline-flex px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {bookings.map((b) => (
              <div key={b.booking_id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-800">{b.course_title}</h3>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                    b.status === "confirmed" ? "bg-green-100 text-green-700"
                    : b.status === "cancelled" ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {b.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">Amount Paid</span>
                    <p className="font-semibold text-gray-800">${b.amount_due?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Payment Plan</span>
                    <p className="font-semibold text-gray-800 capitalize">{b.payment_option}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Booking ID</span>
                    <p className="font-mono text-xs text-brand-700">{b.booking_id}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Enrolled</span>
                    <p className="text-gray-700 text-xs">{b.created_at ? new Date(b.created_at).toLocaleDateString() : "N/A"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
