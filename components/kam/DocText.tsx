import { cn } from "@/components/ui";

/** Minimal, safe markdown rendering (headings, lists, paragraphs) — no HTML injection. */
export function DocText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-ink-soft", className)}>
      {blocks.map((b, i) => {
        const t = b.trim();
        if (/^#\s/.test(t)) return null;
        if (/^#{2,4}\s/.test(t)) {
          const [h, ...rest] = t.split("\n");
          return <div key={i}><h3 id={h.replace(/^#+\s/, "").split(" ")[0]} className="mt-4 text-[15px] font-semibold text-ink">{h.replace(/^#+\s/, "")}</h3>{rest.length > 0 && <p className="mt-1">{rest.join(" ")}</p>}</div>;
        }
        if (/^\[page \d+\]$/i.test(t)) return <div key={i} className="label pt-2">{t.replace(/[[\]]/g, "")}</div>;
        if (/^[-*]\s/m.test(t)) return <ul key={i} className="list-disc space-y-1 pl-5">{t.split("\n").filter((l) => l.trim()).map((l, j) => <li key={j}>{l.replace(/^[-*]\s/, "")}</li>)}</ul>;
        return <p key={i}>{t}</p>;
      })}
    </div>
  );
}
