"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL!;

type CartItem = {
  id: number;
  course_id: number;
  course_title: string;
  course_slug: string;
  price_usd: number;
  discounted_price: number | null;
  created_at: string | null;
};

export default function CartPage() {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentOption, setPaymentOption] = useState("discounted");

  const fetchCart = () => {
    if (!token) return;
    fetch(`${BASE}/user/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    fetchCart();
  }, [token, loading, router]);

  const removeItem = async (itemId: number) => {
    try {
      const res = await fetch(`${BASE}/user/cart/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setMessage("✅ Removed from cart");
      }
    } catch {
      setMessage("❌ Failed to remove");
    }
    setTimeout(() => setMessage(""), 3000);
  };

  const checkout = async () => {
    setCheckingOut(true);
    setMessage("");
    try {
      const res = await fetch(`${BASE}/user/cart/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_option: paymentOption }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        setItems([]);
      } else {
        setMessage(`❌ ${data.detail || "Checkout failed"}`);
      }
    } catch {
      setMessage("❌ Network error");
    } finally {
      setCheckingOut(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const total = items.reduce(
    (sum, item) => sum + (item.discounted_price || item.price_usd),
    0,
  );

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
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl">🦉</Link>
            <h1 className="text-xl font-bold text-brand-900">Shopping Cart</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="px-4 py-2 text-sm rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition-colors">
              📊 Dashboard
            </Link>
            <Link href="/" className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
              ← Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
            message.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message}
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-gray-500 mb-4">Your cart is empty</p>
            <Link
              href="/#courses"
              className="inline-flex px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{item.course_title}</h3>
                    <p className="text-xs text-gray-500">Slug: {item.course_slug}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.discounted_price ? (
                        <>
                          <span className="text-lg font-bold text-brand-700">${item.discounted_price}</span>
                          <span className="text-sm text-gray-400 line-through">${item.price_usd}</span>
                        </>
                      ) : (
                        <span className="text-lg font-bold text-gray-800">${item.price_usd}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium border border-red-200 transition-colors"
                  >
                    ✕ Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold text-gray-800">Total</span>
                <span className="text-2xl font-bold text-brand-700">${total.toLocaleString()}</span>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Option</label>
                <select
                  value={paymentOption}
                  onChange={(e) => setPaymentOption(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-brand-400 outline-none text-sm"
                >
                  <option value="discounted">Discounted Price</option>
                  <option value="upfront">Full Price (Upfront)</option>
                  <option value="installment">Installment Plan</option>
                  <option value="early_bird">Early Bird</option>
                </select>
              </div>

              <button
                onClick={checkout}
                disabled={checkingOut}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-all duration-200 disabled:opacity-50"
              >
                {checkingOut ? "Processing..." : `Checkout — $${total.toLocaleString()}`}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
