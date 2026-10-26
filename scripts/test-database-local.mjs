import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { runDatabaseTests } from './db-test-suite.mjs';
import { runAccountDatabaseTests } from './db-accounts-suite.mjs';
import { runCategoryDatabaseTests } from './db-category-suite.mjs';
import { runRiskDatabaseTests } from './db-risk-suite.mjs';
import { runRemoveProductTests } from './db-remove-product-suite.mjs';

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
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const file of readdirSync(directory).filter(name => /^\d+_.+\.sql$/.test(name)).sort()) await db.exec(readFileSync(new URL(file, directory), 'utf8'));
  await runDatabaseTests((sql, params) => db.query(sql, params));
  await runAccountDatabaseTests((sql, params) => db.query(sql, params));
  await runCategoryDatabaseTests((sql, params) => db.query(sql, params));
  await runRiskDatabaseTests((sql, params) => db.query(sql, params));
  await runRemoveProductTests((sql, params) => db.query(sql, params));
} finally {
  await db.close();
}
