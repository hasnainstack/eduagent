"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.ok) {
        router.push(result.user?.role === "admin" ? "/admin" : "/dashboard");
      } else {
        setError(result.error || "Login failed");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-3xl">🦉</span>
            <span className="font-bold text-xl text-brand-900">DevNest</span>
          </Link>
          <h1 className="text-2xl font-bold text-brand-900 mb-2">Sign In</h1>
          <p className="text-sm text-gray-500">Welcome back to DevNest Academy</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-brand-100 p-8 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="text-center text-xs text-gray-400 pt-2 space-y-1">
            <p>Demo: <span className="font-mono text-brand-600">admin@devnestacademy.com</span> / <span className="font-mono text-brand-600">admin123</span></p>
            <p>New here? <Link href="/register" className="text-brand-600 hover:underline font-medium">Create an account</Link></p>
          </div>
        </form>

        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-gray-500">
            New to DevNest?{" "}
            <Link href="/register" className="text-brand-600 hover:text-brand-700 font-medium">
              Create an account
            </Link>
          </p>
          <Link href="/" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
