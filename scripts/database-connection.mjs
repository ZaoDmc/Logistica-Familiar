import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

export function databaseConnection() {
  const path = new URL('../.env.database.local', import.meta.url);
  let value = process.env.DATABASE_URL;
  if (!value && existsSync(path)) {
    const match = readFileSync(path, 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    value = match?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  if (!value) throw new Error('Guarda DATABASE_URL en .env.database.local según Docs/Fase_1_SQL.md');
  if (value.includes('[YOUR-PASSWORD]')) {
    const passwordPath = new URL('../pass.txt', import.meta.url);
    if (!existsSync(passwordPath)) throw new Error('Completa la contraseña en DATABASE_URL o en pass.txt');
    const password = readFileSync(passwordPath, 'utf8').trim();
    if (!password || /[\r\n]/.test(password)) throw new Error('pass.txt debe contener solamente la contraseña');
    value = value.replace('[YOUR-PASSWORD]', encodeURIComponent(password));
  }
  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('DATABASE_URL debe ser una conexión PostgreSQL');
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
  const supabase = parsed.hostname.endsWith('.supabase.co') || parsed.hostname.endsWith('.pooler.supabase.com');
  const ca = supabase ? readFileSync(new URL('../supabase/certs/prod-ca-2021.crt', import.meta.url), 'utf8') : undefined;
  // Impedir que parámetros de la URL anulen la verificación del certificado.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(key);
  return new pg.Pool({ connectionString: parsed.toString(), ssl: local ? false : { rejectUnauthorized: true, ca },
    max: 6, connectionTimeoutMillis: 15000, statement_timeout: 30000, application_name: 'logistica-familiar-phase1' });
}

export function reportDatabaseError(error) {
  // No imprimir la URL, contraseñas ni detalles que puedan contener datos.
  console.error(`Operación SQL fallida (${error.code || error.name || 'error'}). Revisa la conexión y la guía de fase 1.`);
  if (error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') console.error('Prueba la cadena de Session pooler (IPv4) del mismo proyecto.');
  if (error.code === '28P01') console.error('Supabase rechazó la contraseña PostgreSQL de la conexión.');
  if (error.code === 'ERR_ASSERTION') console.error(error.message);
  process.exitCode = 1;
}
