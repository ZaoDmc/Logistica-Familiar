import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { adminClient, localSecrets, management, projectConfig } from './supabase-management.mjs';
import { databaseConnection, reportDatabaseError } from './database-connection.mjs';

// Datos y enlace fuera de Git. Nunca usar .env.admin.local para otra familia.
const env = localSecrets('.env.household.local');
const email = env.HOUSEHOLD_ADMIN_EMAIL?.trim().toLowerCase();
const name = env.HOUSEHOLD_ADMIN_NAME?.trim(), homeName = env.HOUSEHOLD_NAME?.trim();
const apply = process.argv.includes('--apply');
let pool;
try {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 80 || !homeName || homeName.length > 80) {
    throw Object.assign(new Error(), { code: 'COMPLETE_ENV_HOUSEHOLD_LOCAL' });
  }
  pool = databaseConnection();
  const existing = await pool.query('select id from auth.users where lower(email)=$1', [email]);
  let userId = existing.rows[0]?.id, homeId;
  const inspect = async client => {
    const rows = userId ? (await client.query(`select m.household_id,m.role,h.name from public.household_members m
      join public.households h on h.id=m.household_id where m.user_id=$1`, [userId])).rows : [];
    if (rows.length) {
      if (rows.length !== 1 || rows[0].role !== 'admin' || rows[0].name !== homeName) {
        throw Object.assign(new Error(), { code: 'EXISTING_MEMBERSHIP_REQUIRES_REVIEW' });
      }
      homeId = rows[0].household_id;
    } else if ((await client.query('select 1 from public.households where lower(btrim(name))=lower($1)', [homeName])).rowCount) {
      throw Object.assign(new Error(), { code: 'HOUSEHOLD_NAME_ALREADY_EXISTS' });
    }
  };
  await inspect(pool);
  if (!apply) {
    console.log(homeId ? 'Revisión correcta: el hogar y su admin ya existen; no se duplicarán.' : 'Revisión correcta: se puede preparar un hogar independiente con su admin.');
    console.log('Sin cambios. Ejecutar con --apply para preparar el acceso privado.');
  } else {
    const { ref, url } = projectConfig();
    const authConfig = await management(`/projects/${ref}/config/auth`);
    const origin = new URL(authConfig.site_url);
    if (origin.origin !== 'https://logistica-familiar.vercel.app') throw Object.assign(new Error(), { code: 'UNEXPECTED_PRODUCTION_ORIGIN' });
    const admin = await adminClient();
    if (!userId) {
      // Credencial aleatoria solo en memoria. La destinataria elegirá su contraseña
      // con el enlace privado de recuperación, que no envía correo automáticamente.
      const result = await admin.auth.admin.createUser({ email, password: randomBytes(40).toString('base64url') + 'Aa1!', email_confirm: true });
      if (result.error || !result.data.user) throw Object.assign(new Error(), { code: result.error?.code || 'AUTH_CREATE_FAILED' });
      userId = result.data.user.id;
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtextextended('onboarding/' || $1,0))", [email]);
      await inspect(client);
      if (!homeId) homeId = (await client.query('select private.bootstrap_household($1,$2,$3) as id', [userId, homeName, name])).rows[0].id;
      // Verificar con la identidad de la nueva administradora, bajo RLS.
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
      const homes = await client.query('select id from public.households');
      const role = await client.query('select role from public.household_members where household_id=$1 and user_id=$2', [homeId,userId]);
      if (homes.rowCount !== 1 || homes.rows[0].id !== homeId || role.rows[0]?.role !== 'admin') throw Object.assign(new Error(), { code: 'HOUSEHOLD_ISOLATION_FAILED' });
      await client.query('commit');
    } catch(error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: origin.origin } });
    if (error || !data.properties?.action_link) throw Object.assign(new Error(), { code: error?.code || 'AUTH_LINK_FAILED' });
    const link = new URL(data.properties.action_link);
    if (link.origin !== new URL(url).origin || link.searchParams.get('redirect_to') !== origin.origin) throw Object.assign(new Error(), { code: 'UNEXPECTED_ACCESS_LINK' });
    const receipt = { household_name: homeName, admin_name: name, email, household_id: homeId, user_id: userId,
      generated_at: new Date().toISOString(), expires_in_seconds: Number(authConfig.mailer_otp_exp) || null, access_url: link.href };
    writeFileSync(new URL('../.household-access.local', import.meta.url), JSON.stringify(receipt,null,2) + '\n');
    writeFileSync(new URL('../.household-message.local', import.meta.url),
      `Hola ${name}, tu hogar «${homeName}» ya está preparado.\n\nAbre este enlace privado para elegir una contraseña de al menos 10 caracteres:\n${link.href}\n\nLa pantalla puede decir «Recupera tu acceso»; es el paso para elegir tu primera contraseña. Hazlo en tu propio celular. El enlace caduca y es de un solo uso: no lo compartas con otros integrantes. Si vence, pide uno nuevo.\n\nDespués entra en ${origin.origin} con tu correo. Desde Integrantes puedes invitar a tu familia. Todos podrán agregar categorías y productos, contar stock y revisar Reposición. El inventario está separado del de las otras familias.\n`);
    console.log('Hogar y admin preparados; pertenencia y aislamiento comprobados con RLS.');
    console.log('Enlace y mensaje en .household-access.local y .household-message.local (privados, excluidos de Git).');
    console.log('No se envió correo ni se modificaron contraseñas de cuentas existentes.');
    console.log(`Vigencia del enlace: ${receipt.expires_in_seconds ? receipt.expires_in_seconds + ' segundos desde su generación' : 'según la configuración de Auth'}.`);
  }
} catch(error) { reportDatabaseError(error); }
finally { if (pool) await pool.end(); }
