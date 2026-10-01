import { requireSession } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "@/types/domain";
import { PasswordForm } from "./PasswordForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile } = await requireSession();
  const health = {
    mistral: !!process.env.MISTRAL_API_KEY,
    intent: process.env.HF_MODEL_URL ? "DistilBERT endpoint" : "Rule-based fallback (no HF_MODEL_URL)",
    embeddings: (process.env.EMBEDDINGS_PROVIDER ?? "hf-api") + (process.env.HF_API_TOKEN || process.env.EMBEDDINGS_PROVIDER === "transformers" ? "" : " (no token — full-text retrieval)"),
  };
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">Name</dt><dd>{profile.full_name}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Email</dt><dd>{profile.email}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Role</dt><dd>{ROLE_LABEL[profile.role]}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">Role and assignments are managed by HR.</p>
        </Card>
        <Card title="Change password"><PasswordForm /></Card>
        <Card title="AI services" subtitle="Server-side configuration (no keys are exposed to the browser)">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Response generation</dt><dd className="text-right">{health.mistral ? "Mistral Large" : "Extractive answers (MISTRAL_API_KEY not set)"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Intent router</dt><dd className="text-right">{health.intent}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Embeddings</dt><dd className="text-right">all-MiniLM-L6-v2 via {health.embeddings}</dd></div>
          </dl>
        </Card>
      </div>
    </>
  );
}
