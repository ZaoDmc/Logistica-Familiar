import { writeFileSync } from 'node:fs';
import { adminClient, localSecrets, management, projectConfig } from './supabase-management.mjs';
import { databaseConnection, reportDatabaseError } from './database-connection.mjs';
let pool;
try {
  const email = localSecrets('.env.admin.local').ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw Object.assign(new Error(), { code: 'COMPLETE_ENV_ADMIN_LOCAL' });
  pool = databaseConnection();
  const result = await pool.query("select 1 from auth.users u join public.household_members m on m.user_id=u.id where lower(u.email)=$1 and m.role='admin'", [email]);
  if (!result.rowCount) throw Object.assign(new Error(), { code: 'ADMIN_NOT_FOUND' });
  const { ref } = projectConfig();
  const config = await management(`/projects/${ref}/config/auth`);
  const admin = await adminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: config.site_url } });
  if (error) throw error;
  writeFileSync(new URL('../.admin-recovery.local', import.meta.url), data.properties.action_link + '\n');
  console.log('Enlace de recuperación guardado en .admin-recovery.local (privado, no versionado). No se envió correo.');
} catch (error) { reportDatabaseError(error); }
finally { if (pool) await pool.end(); }
