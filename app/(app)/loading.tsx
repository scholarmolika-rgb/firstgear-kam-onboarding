export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-56 rounded bg-line" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-lg bg-line/70" />)}</div>
      <div className="h-64 rounded-lg bg-line/60" />
    </div>
  );
}
