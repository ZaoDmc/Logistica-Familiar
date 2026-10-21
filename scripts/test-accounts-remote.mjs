import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { adminClient, management, projectConfig } from './supabase-management.mjs';
import { databaseConnection, reportDatabaseError } from './database-connection.mjs';

let pool, admin;
const users = [], homes = [];
const emails = [];
let passed = 0;
const check = (value, label) => { assert.ok(value, label); passed++; };
const { url, publicKey, ref } = projectConfig();
const freshClient = () => createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
async function account(label) {
  const email = `phase2-${randomUUID()}@example.invalid`, password = `Aa1!${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id); emails.push(email);
  const client = freshClient();
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  check(Boolean(login.data.session), `Inicio de sesión real: ${label}`);
  return { id: data.user.id, email, password, client, token: login.data.session.access_token };
}
async function call(action, fields = {}, token, expected = 200, origin = 'http://localhost:5173') {
  const result = await fetch(`${url}/functions/v1/household-admin`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publicKey, Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...fields }), signal: AbortSignal.timeout(30000) });
  const data = await result.json();
  check(result.status === expected, `${action}: HTTP ${result.status}, esperado ${expected}${data.error ? ` (${data.error})` : ''}`);
  return data;
}
const linkToken = data => new URLSearchParams(new URL(data.url).hash.slice(1)).get('invite');
try {
  admin = await adminClient(); pool = databaseConnection();
  const config = await management(`/projects/${ref}/config/auth`);
  check(config.disable_signup === true, 'Registro público cerrado');
  check(config.external_email_enabled === true, 'Correo y contraseña habilitados');
  const owner = await account('admin'), member = await account('integrante'), foreign = await account('admin ajeno');
  const home = randomUUID(), otherHome = randomUUID(); homes.push(home, otherHome);
  await pool.query("insert into public.households(id,name) values ($1,'Prueba HTTP temporal'),($2,'Otro hogar temporal')", [home, otherHome]);
  for (const [person, household, role] of [[owner, home, 'admin'], [member, home, 'integrante'], [foreign, otherHome, 'admin']]) {
    await pool.query('insert into public.profiles(id,display_name) values ($1,$2)', [person.id, `Prueba ${role}`]);
    await pool.query('insert into public.household_members(household_id,user_id,role) values ($1,$2,$3)', [household, person.id, role]);
  }
  const inviteEmail = `phase2-${randomUUID()}@example.invalid`; emails.push(inviteEmail);
  const fields = { household_id: home, invitation_id: randomUUID(), email: inviteEmail, display_name: 'Nuevo integrante' };
  await call('create', fields, undefined, 401);
  await call('create', fields, 'token-falso', 401);
  await call('create', fields, member.token, 403);
  await call('create', fields, foreign.token, 403);
  await call('create', fields, owner.token, 403, 'https://sitio-ajeno.invalid');
  const invitation = await call('create', fields, owner.token);
  check(Boolean(linkToken(invitation)), 'Admin obtiene enlace privado');
  await call('inspect', { token: linkToken(invitation) });
  const renewed = await call('renew', { household_id: home, invitation_id: fields.invitation_id }, owner.token);
  await call('inspect', { token: linkToken(invitation) }, undefined, 410);
  const token = linkToken(renewed);
  await call('accept', { token, password: 'corta' }, undefined, 400);
  await call('accept', { token }, member.token, 403);
  const password = `Aa1!${randomUUID()}`;
  await call('accept', { token, password });
  const joined = freshClient();
  const login = await joined.auth.signInWithPassword({ email: inviteEmail, password });
  if (login.error) throw login.error;
  users.push(login.data.user.id);
  check(Boolean(login.data.session), 'Nuevo integrante entra con su propia contraseña');
  const membership = await joined.from('household_members').select('role,household_id').eq('user_id', login.data.user.id);
  check(!membership.error && membership.data.length === 1 && membership.data[0].role === 'integrante' && membership.data[0].household_id === home, 'Alta asignada al hogar y rol correctos');
  const forgedRpc = await joined.rpc('manage_household_invitation', { p_actor_id: owner.id, p_household_id: home, p_action: 'create', p_invitation_id: randomUUID(), p_email: 'forged@example.invalid', p_display_name: 'Falso', p_token_hash: 'a'.repeat(64) });
  check(forgedRpc.error?.code === '42501', 'No puede saltar la función de servidor ni suplantar actor');
  await call('create', { ...fields, invitation_id: randomUUID(), email: 'blocked@example.invalid' }, login.data.session.access_token, 403);
  await call('inspect', { token }, undefined, 410);

  const existingFields = { household_id: home, invitation_id: randomUUID(), email: foreign.email, display_name: 'Cuenta existente' };
  const existing = await call('create', existingFields, owner.token);
  await call('accept', { token: linkToken(existing), password }, undefined, 409);
  await call('accept', { token: linkToken(existing) }, foreign.token);
  check((await foreign.client.from('household_members').select('household_id').eq('user_id', foreign.id)).data.length === 2, 'Cuenta existente debe acreditar su sesión para unirse');

  const revokedFields = { ...fields, invitation_id: randomUUID(), email: `revoked-${randomUUID()}@example.invalid` };
  const revoked = await call('create', revokedFields, owner.token);
  await call('revoke', { household_id: home, invitation_id: revokedFields.invitation_id }, owner.token);
  await call('accept', { token: linkToken(revoked), password }, undefined, 410);
  await call('recovery', { household_id: home, user_id: member.id }, member.token, 403);
  await call('recovery', { household_id: otherHome, user_id: member.id }, foreign.token, 403);
  await call('recovery', { household_id: home, user_id: owner.id }, owner.token, 403);
  const recovery = await call('recovery', { household_id: home, user_id: member.id }, owner.token);
  const recoveryToken = new URL(recovery.url).searchParams.get('token');
  const recovered = freshClient();
  const verified = await recovered.auth.verifyOtp({ type: 'recovery', token_hash: recoveryToken });
  if (verified.error) throw verified.error;
  const newPassword = `Aa1!${randomUUID()}`;
  const changed = await recovered.auth.updateUser({ password: newPassword });
  check(!changed.error, 'Recuperación manual permite elegir nueva contraseña sin correo');
  const relogin = await freshClient().auth.signInWithPassword({ email: member.email, password: newPassword });
  check(!relogin.error, 'Nueva contraseña funciona');
  await joined.auth.signOut({ scope: 'local' });
  const afterLogout = await joined.auth.getSession();
  check(afterLogout.data.session === null, 'Cierre de sesión borra la sesión local');
  console.log(`Cuentas HTTP/Auth: ${passed} comprobaciones correctas contra Supabase real.`);
} catch (error) { reportDatabaseError(error); }
finally {
  if (pool) {
    const cleanup = await pool.connect();
    try {
      await cleanup.query('begin');
      await cleanup.query('delete from public.household_invitations where household_id=any($1::uuid[])', [homes]);
      await cleanup.query('delete from public.household_members where household_id=any($1::uuid[])', [homes]);
      await cleanup.query('delete from public.households where id=any($1::uuid[])', [homes]);
      const candidates = await cleanup.query('select id from auth.users where email=any($1::text[])', [emails]);
      const ids = [...new Set([...users, ...candidates.rows.map(row => row.id)])];
      await cleanup.query('delete from public.profiles where id=any($1::uuid[])', [ids]);
      await cleanup.query('commit');
      for (const id of ids) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
      }
      console.log('Cuentas y hogares temporales de las pruebas HTTP eliminados.');
    } catch (error) {
      await cleanup.query('rollback').catch(() => {});
      console.error(`Revisar limpieza de hogares temporales: ${homes.join(', ')}.`);
      reportDatabaseError(error);
    } finally { cleanup.release(); await pool.end(); }
  }
}
