import { adminClient, localSecrets } from './supabase-management.mjs';
import { databaseConnection, reportDatabaseError } from './database-connection.mjs';

let pool;
try {
  const env = localSecrets('.env.admin.local');
  const email = env.ADMIN_EMAIL?.trim().toLowerCase(), name = env.ADMIN_NAME?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 80 || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 10 || env.ADMIN_PASSWORD.length > 128) {
    throw Object.assign(new Error(), { code: 'COMPLETE_ENV_ADMIN_LOCAL' });
  }
  pool = databaseConnection();
  let id = (await pool.query('select id from auth.users where lower(email)=$1', [email])).rows[0]?.id;
  if (!id) {
    const admin = await adminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password: env.ADMIN_PASSWORD, email_confirm: true });
    if (error) throw error;
    id = data.user.id;
  }
  const prior = await pool.query("select household_id,role from public.household_members where user_id=$1", [id]);
  if (prior.rows.length) {
    if (!prior.rows.some(row => row.role === 'admin')) throw Object.assign(new Error(), { code: 'USER_ALREADY_MEMBER' });
    console.log('La cuenta ya tiene un hogar con rol admin. No se cambió su contraseña.');
  } else {
    await pool.query('select private.bootstrap_household($1,$2,$3)', [id, env.HOUSEHOLD_NAME?.trim() || 'Hogar', name]);
    console.log('Cuenta admin y primer hogar creados. Inicia sesión con los datos de .env.admin.local.');
  }
} catch (error) { reportDatabaseError(error); }
finally { if (pool) await pool.end(); }
