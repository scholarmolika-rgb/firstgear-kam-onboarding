import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between bg-accent-strong p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="7" fill="#fff" fillOpacity=".12" /><circle cx="16" cy="16" r="8.5" fill="none" stroke="#fff" strokeWidth="2" /><path d="M16 9.5 18.6 16 16 22.5 13.4 16z" fill="#fff" /></svg>
          <div>
            <div className="text-sm font-bold tracking-[0.16em]">FIRSTGEAR</div>
            <div className="text-[11px] tracking-[0.14em] text-white/70">KAM ONBOARDING COMPASS</div>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">Learn first.<br />Then earn access.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">
            A guided, evidence-based 30-day readiness journey for Key Account Managers. Gates — not the calendar — decide when you take on customers and pricing. Readiness is a human decision.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 text-sm">
            {[["4", "capability pillars"], ["3", "readiness gates"], ["30", "day journey"]].map(([n, l]) => (
              <div key={l}><dt className="text-2xl font-semibold">{n}</dt><dd className="text-white/65">{l}</dd></div>
            ))}
          </dl>
        </div>
        <div className="text-xs text-white/50">Governance · People · Process · Product</div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="text-sm font-bold tracking-[0.16em]">FIRSTGEAR</div>
            <div className="text-[11px] tracking-[0.14em] text-ink-muted">KAM ONBOARDING COMPASS</div>
          </div>
          <h2 className="text-xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-ink-muted">Use your FirstGear account.</p>
          {configured ? <LoginForm next={next} /> : (
            <div className="mt-6 rounded-md border border-warn/30 bg-warn-soft p-4 text-sm text-warn">
              Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and anon key, then restart. See <code>docs/SUPABASE_SETUP.md</code>.
            </div>
          )}
          <div className="mt-8 rounded-md border border-line bg-surface p-4 text-xs text-ink-muted">
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
