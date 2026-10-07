import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between border-r border-line bg-canvas p-12 lg:flex">
        <div className="flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden className="text-accent"><rect width="32" height="32" rx="8" fill="currentColor" /><circle cx="16" cy="16" r="8.5" fill="none" stroke="#fff" strokeWidth="2" /><path d="M16 9.5 18.6 16 16 22.5 13.4 16z" fill="#fff" /></svg>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">FirstGear</div>
            <div className="text-xs text-ink-muted">KAM Onboarding Compass</div>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">Learn first.<br />Then earn access.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
            A guided, evidence-based 30-day readiness journey for Key Account Managers. Gates — not the calendar — decide when you take on customers and pricing. Readiness is a human decision.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 text-sm">
            {[["4", "capability pillars"], ["3", "readiness gates"], ["30", "day journey"]].map(([n, l]) => (
              <div key={l}><dt className="text-2xl font-semibold text-ink">{n}</dt><dd className="text-ink-muted">{l}</dd></div>
            ))}
          </dl>
        </div>
        <div className="text-xs text-ink-faint">Governance · People · Product · Process</div>
      </div>
      <div className="flex items-center justify-center bg-surface px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="text-[15px] font-semibold text-ink">FirstGear</div>
            <div className="text-xs text-ink-muted">KAM Onboarding Compass</div>
          </div>
          <h2 className="text-[22px] font-semibold tracking-[-0.015em]">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-muted">Sign in with your FirstGear account.</p>
          {error === "direct" && <div role="alert" className="mt-3 rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">Direct sign-in is unavailable right now. Please sign in with email and password.</div>}
          {configured ? <LoginForm next={next} /> : (
            <div className="mt-6 rounded-md border border-warn/30 bg-warn-soft p-4 text-sm text-warn">
              Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and anon key, then restart. See <code>docs/SUPABASE_SETUP.md</code>.
            </div>
          )}
          <div className="mt-8 rounded-lg border border-line bg-canvas p-4 text-xs text-ink-muted">
            <div className="mb-1.5 font-semibold text-ink-soft">Demo accounts (synthetic)</div>
            <ul className="space-y-0.5 font-mono text-[11px]">
              <li>riya.sharma@firstgear.example — KAM</li>
              <li>arjun.rao@firstgear.example — Mentor</li>
              <li>meera.iyer@firstgear.example — Reporting Boss</li>
              <li>kavya.nair@firstgear.example — HR / Admin</li>
            </ul>
            <div className="mt-1.5">Password: the <code>DEMO_PASSWORD</code> used when seeding.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
