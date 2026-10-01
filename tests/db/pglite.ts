/**
 * Runs the real Supabase migrations inside PGlite (Postgres compiled to WASM,
 * with pgvector) so schema, seed data and RLS policies are executed — not
 * just linted — in CI without Docker.
 *
 * A minimal stand-in for Supabase's `auth` schema and API roles is created
 * first: auth.users, auth.uid() (reads request.jwt.claim.sub, like Supabase),
 * and the anon / authenticated / service_role roles.
 */
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const AUTH_STUB = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export async function createMigratedDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { vector } });
  await db.exec(AUTH_STUB);
  const dir = path.resolve(__dirname, "..", "..", "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Run a callback as a signed-in Supabase user (RLS enforced). */
export async function asUser<T>(db: PGlite, userId: string, fn: (db: PGlite) => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn(db);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
