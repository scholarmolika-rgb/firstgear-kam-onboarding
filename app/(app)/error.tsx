"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-line bg-surface p-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-ink-muted">{error.message?.includes("Missing environment variable") ? error.message : "The page could not be loaded. Your data is safe — nothing was changed."}</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-ink-faint">Ref {error.digest}</p>}
      <button className="btn-primary mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
