"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-brand-900 mb-2">Something went wrong</h1>
        <p className="text-gray-500 mb-6 text-sm">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-lg shadow-brand-500/25 transition-all duration-200"
        >
          Try Again
        </button>
        <div className="mt-4">
          <a href="/" className="text-sm text-brand-600 hover:underline">
            ← Back to Home
          </a>
        </div>
      </div>
    </main>
  );
}
