import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Owl illustration */}
        <div className="text-8xl mb-6 animate-bounce">🦉</div>

        <h1 className="text-6xl sm:text-8xl font-extrabold text-brand-900 mb-2">404</h1>
        <h2 className="text-xl sm:text-2xl font-bold text-brand-700 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Hoot hoot! Looks like this page flew the nest.
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>

        {/* Suggestions */}
        <div className="grid sm:grid-cols-2 gap-3 mb-8 text-left">
          <Link
            href="/"
            className="flex items-center gap-3 p-4 rounded-xl bg-white border border-brand-100 hover:border-brand-300 hover:shadow-md transition-all group"
          >
            <span className="text-2xl">🏠</span>
            <div>
              <p className="text-sm font-semibold text-brand-900 group-hover:text-brand-700">Home</p>
              <p className="text-xs text-gray-400">Back to landing</p>
            </div>
          </Link>
          <Link
            href="/chat"
            className="flex items-center gap-3 p-4 rounded-xl bg-white border border-brand-100 hover:border-brand-300 hover:shadow-md transition-all group"
          >
            <span className="text-2xl">💬</span>
            <div>
              <p className="text-sm font-semibold text-brand-900 group-hover:text-brand-700">Chat with Nova</p>
              <p className="text-xs text-gray-400">Talk to our AI</p>
            </div>
          </Link>
          <Link
            href="/#courses"
            className="flex items-center gap-3 p-4 rounded-xl bg-white border border-brand-100 hover:border-brand-300 hover:shadow-md transition-all group"
          >
            <span className="text-2xl">📚</span>
            <div>
              <p className="text-sm font-semibold text-brand-900 group-hover:text-brand-700">Courses</p>
              <p className="text-xs text-gray-400">Browse programs</p>
            </div>
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-3 p-4 rounded-xl bg-white border border-brand-100 hover:border-brand-300 hover:shadow-md transition-all group"
          >
            <span className="text-2xl">🔐</span>
            <div>
              <p className="text-sm font-semibold text-brand-900 group-hover:text-brand-700">Admin</p>
              <p className="text-xs text-gray-400">Dashboard</p>
            </div>
          </Link>
        </div>

        {/* CTA */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-lg shadow-xl shadow-brand-500/30 transition-all duration-200 hover:shadow-2xl hover:-translate-y-0.5"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}
