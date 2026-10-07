/**
 * Applies one or more SQL migration files to the live Supabase database in a
 * single transaction, then records them in public.app_migrations.
 *
 *   npx tsx scripts/run-migration.ts supabase/migrations/008_support_chat.sql
 *
 * Needs SUPABASE_DB_URL in .env.local (Supabase → Project Settings →
 * Database → Connection string → URI). The URL holds the database password:
 * it stays on your machine and is never committed or deployed.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("Add SUPABASE_DB_URL to .env.local first (Supabase → Project Settings → Database → Connection string → URI).");
    process.exit(1);
  }
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Usage: npx tsx scripts/run-migration.ts <file.sql> [...]");
    process.exit(1);
  }
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    await db.query(`create table if not exists public.app_migrations (name text primary key, applied_at timestamptz not null default now())`);
    await db.query(`alter table public.app_migrations enable row level security`);
    for (const f of files) {
      const name = path.basename(f);
      await db.query("begin");
      try {
        await db.query(readFileSync(f, "utf8"));
        await db.query("insert into public.app_migrations (name) values ($1) on conflict (name) do update set applied_at = now()", [name]);
        await db.query("commit");
        console.log(`applied ${name}`);
      } catch (e) {
        await db.query("rollback");
        throw new Error(`${name} failed and was rolled back: ${(e as Error).message}`);
      }
    }
    const { rows } = await db.query<{ name: string; applied_at: Date }>("select name, applied_at from public.app_migrations order by name");
    console.log("Recorded migrations:", rows.map((r) => r.name).join(", "));
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
