export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse text-brand-300">🔄</div>
        <p className="text-gray-400 text-sm">Loading dashboard...</p>
      </div>
    </main>
  );
}
