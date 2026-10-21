import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { projectConfig } from './supabase-management.mjs';

export function inventoryTestClient() {
  const config = projectConfig();
  return createClient(config.url, config.publicKey, { db: { retry: false }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(20000) }) } });
}
export async function createInventoryFixture(admin, pool, fixture, save = () => {}) {
  for (const [role, name] of [['admin', 'Admin de prueba'], ['integrante', 'Integrante de prueba'], ['outsider', 'Otra persona']]) {
    const email = `phase3-${randomUUID()}@example.invalid`, password = `Aa1!${randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    fixture.users.push({ id: data.user.id, email, password, role, name }); save();
  }
  fixture.home = randomUUID(); fixture.foreignHome = randomUUID(); save();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("insert into public.households(id,name) values ($1,'Hogar de prueba fase 3'),($2,'Hogar ajeno fase 3')", [fixture.home, fixture.foreignHome]);
    for (const user of fixture.users) {
      await client.query('insert into public.profiles(id,display_name) values ($1,$2)', [user.id,user.name]);
      await client.query('insert into public.household_members(household_id,user_id,role) values ($1,$2,$3)', [user.role === 'outsider' ? fixture.foreignHome : fixture.home, user.id, user.role === 'outsider' ? 'admin' : user.role]);
    }
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
  return fixture;
}
export async function loginFixture(user) {
  const client = inventoryTestClient();
  const {error} = await client.auth.signInWithPassword({email:user.email,password:user.password});
  if (error) throw error;
  return client;
}
export async function cleanupInventoryFixture(admin, pool, fixture) {
  const validUsers = fixture.users.filter(user => /^phase3-[a-f0-9-]+@example\.invalid$/.test(user.email));
  if (validUsers.length !== fixture.users.length) throw new Error('UNEXPECTED_FIXTURE_USERS');
  const homes = [fixture.home,fixture.foreignHome].filter(Boolean);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const actual = await client.query('select name from public.households where id=any($1::uuid[])', [homes]);
    if (actual.rows.some(row => !['Hogar de prueba fase 3','Hogar ajeno fase 3'].includes(row.name))) throw new Error('UNEXPECTED_FIXTURE_HOUSEHOLD');
    for (const table of ['stock_movements','products','categories','household_invitations','household_members']) await client.query(`delete from public.${table} where household_id=any($1::uuid[])`, [homes]);
    await client.query('delete from public.households where id=any($1::uuid[])', [homes]);
    for (const user of validUsers) {
      const match = await client.query('select email from auth.users where id=$1', [user.id]);
      if (match.rows.length && match.rows[0].email !== user.email) throw new Error('UNEXPECTED_FIXTURE_ACCOUNT');
      await client.query('delete from public.profiles where id=$1', [user.id]);
    }
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
  for (const user of validUsers) { const {error} = await admin.auth.admin.deleteUser(user.id); if(error) throw error; }
}
