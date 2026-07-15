// Shown instantly on navigation while the server renders the page. Without it,
// tapping a tab appears to "do nothing" until the server round-trip completes —
// which feels laggy on a phone. The skeleton gives immediate feedback.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6">
      <div className="h-9 w-56 rounded-lg bg-white/[0.06]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white/[0.05]" />
    </div>
  );
}
