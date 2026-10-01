import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="label">404</div>
      <h1 className="mt-2 text-xl font-semibold">Not found or not accessible</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">The page doesn&apos;t exist, or your role doesn&apos;t give you access to it.</p>
      <Link href="/" className="btn-primary mt-5">Go to your dashboard</Link>
    </div>
  );
}
