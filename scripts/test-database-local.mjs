import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { runDatabaseTests } from './db-test-suite.mjs';

const db = new PGlite();
try {
  // Sustituto mínimo del servicio Auth, no se ejecuta en Supabase.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/202610210001_household_inventory.sql', import.meta.url), 'utf8'));
  await runDatabaseTests((sql, params) => db.query(sql, params));
} finally {
  await db.close();
}
