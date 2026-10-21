import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { databaseConnection, reportDatabaseError } from './database-connection.mjs';

let pool;
try {
  pool = databaseConnection();
  const client = await pool.connect();
  try {
    // Registro propio para aplicación directa; no suplanta supabase_migrations.
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtextextended('logistica-familiar/migrate', 0))");
    await client.query('create schema if not exists private');
    await client.query('revoke all on schema private from public, anon, authenticated');
    await client.query(`create table if not exists private.app_migrations (
      version text primary key, sha256 text not null, applied_at timestamptz not null default now()
    )`);
    await client.query('revoke all on private.app_migrations from public, anon, authenticated');
    const version = '202610210001';
    const sql = readFileSync(new URL('../supabase/migrations/202610210001_household_inventory.sql', import.meta.url), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const prior = await client.query('select sha256 from private.app_migrations where version=$1', [version]);
    if (prior.rows.length) {
      if (prior.rows[0].sha256 !== hash) throw Object.assign(new Error(), { code: 'MIGRATION_CHANGED' });
      // Restaurar USAGE que la migración concede a authenticated.
      await client.query('grant usage on schema private to authenticated');
      await client.query('commit');
      console.log(`Migración ${version}: ya aplicada, sin cambios.`);
    } else {
      // La transacción exterior hace atómico el esquema y su registro.
      await client.query(sql.replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, ''));
      await client.query('insert into private.app_migrations(version,sha256) values ($1,$2)', [version, hash]);
      await client.query('commit');
      console.log(`Migración ${version}: aplicada correctamente.`);
    }
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
} catch (error) { reportDatabaseError(error); }
finally { if (pool) await pool.end(); }
