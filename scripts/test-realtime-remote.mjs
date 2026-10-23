import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { adminClient } from './supabase-management.mjs';
import { databaseConnection, reportDatabaseError } from './database-connection.mjs';
import { createInventoryFixture, cleanupInventoryFixture, loginFixture } from './inventory-test-fixture.mjs';
import { watchInventory } from '../src/lib/inventory-sync.ts';
const fixture = { users: [] }, clients = [], stops = [], samples = [];
let pool, admin, passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed++; };
const wait = async (condition, label, ms = 30000) => {
  const until = Date.now() + ms;
  while (!condition()) { if (Date.now() > until) throw new Error(`TIMEOUT: ${label}`); await new Promise(resolve => setTimeout(resolve, 40)); }
};
async function ok(query) { const result = await query; if (result.error) throw result.error; return result.data; }
try {
  pool = databaseConnection(); admin = await adminClient(); await createInventoryFixture(admin, pool, fixture);
  const published = await pool.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'");
  check(['categories','products','stock_movements'].every(table => published.rows.some(row => row.tablename === table)), 'Tablas publicadas');
  for (let index = 0; index < 5; index++) clients.push(await loginFixture(fixture.users[index % 2]));
  const outsider = await loginFixture(fixture.users[2]); clients.push(outsider);
  const versions = Array(5).fill(0), events = Array(5).fill(0), categories = Array(5).fill(0), histories = Array(5).fill(0), ready = Array(5).fill(false);
  let product, forbidden = 0;
  for (let index = 0; index < 5; index++) {
    stops.push(watchInventory(clients[index], fixture.home, () => {
      events[index]++;
      void Promise.all([
        clients[index].from('products').select('version').eq('household_id', fixture.home),
        clients[index].from('categories').select('id').eq('household_id', fixture.home),
        clients[index].from('stock_movements').select('id').eq('household_id', fixture.home),
      ]).then(([p,c,h]) => { versions[index] = Math.max(0,...(p.data || []).map(row => Number(row.version))); categories[index] = c.data?.length || 0; histories[index] = h.data?.length || 0; });
    }, status => { ready[index] = status === 'live'; console.log(`Sesión ${index + 1}: ${status}`); }));
  }
  let outsiderReady = false;
  const foreignChannel = outsider.channel(`isolation:${randomUUID()}`).on('postgres_changes', {event:'*',schema:'public',table:'products',filter:`household_id=eq.${fixture.home}`}, () => forbidden++).subscribe(status => { outsiderReady = status === 'SUBSCRIBED'; });
  await wait(() => ready.every(Boolean) && outsiderReady, 'Seis canales autenticados');
  check(ready.every(Boolean), 'Cinco sesiones conectadas');
  const category = await ok(clients[1].from('categories').insert({household_id:fixture.home,name:'Prueba Realtime',icon_id:'pet'}).select('id').single());
  await wait(() => categories.every(count => count === 1), 'Categoría recibida'); check(true, 'Categoría visible en cinco sesiones');
  const movement = await ok(clients[0].rpc('create_product', {p_household_id:fixture.home,p_category_id:category.id,p_name:'Producto Realtime',p_description:'Temporal',p_icon_id:'pet',p_initial_stock:1,p_operation_id:randomUUID()})); product = movement.product_id;
  await wait(() => versions.every(value => value === 1) && histories.every(value => value === 1), 'Producto e historial'); check(true, 'Producto e historial recibidos');
  const change = client => ok(client.rpc('change_stock',{p_product_id:product,p_operation_id:randomUUID(),p_kind:'delta',p_quantity:1,p_expected_version:null}));
  for (let index = 0; index < 3; index++) {
    const start = Date.now(); await change(clients[index]);
    await wait(() => versions.every(value => value === index + 2) && histories.every(value => value === index + 2), 'Stock e historial sincronizados'); samples.push(Date.now() - start);
  }
  check(samples.every(ms => ms <= 2000), 'Cambios y reconsulta en cinco sesiones dentro de dos segundos');
  await Promise.all([change(clients[0]), change(clients[1])]);
  await wait(() => versions.every(value => value === 6), 'Cambios simultáneos'); check(true, 'Concurrencia sincronizada');
  const target = await ok(clients[1].from('categories').insert({household_id:fixture.home,name:'Destino Realtime',icon_id:'other'}).select('id').single());
  const empty = await ok(clients[1].from('categories').insert({household_id:fixture.home,name:'Vacía Realtime',icon_id:'other'}).select('id').single());
  await wait(() => categories.every(count => count === 3), 'Categorías de traslado recibidas');
  await ok(clients[1].rpc('remove_category',{p_household_id:fixture.home,p_category_id:empty.id,p_destination_id:null}));
  await wait(() => categories.every(count => count === 2), 'Eliminación vacía recibida sin cambios de productos');
  check(true, 'Quitar vacía se refleja en cinco sesiones por Realtime');
  await ok(clients[1].rpc('remove_category',{p_household_id:fixture.home,p_category_id:category.id,p_destination_id:target.id}));
  await wait(() => categories.every(count => count === 1), 'Traslado y categoría sincronizados');
  const moved = await ok(clients[0].from('products').select('category_id,stock,version').eq('id',product).single());
  check(moved.category_id === target.id && moved.stock === 6 && Number(moved.version) === 6, 'Traslado conserva cantidades y versiones en el destino');
  check(histories.every(value => value === 6), 'Traslado no altera el historial de stock');
  stops[4](); const before = events[4]; await change(clients[0]);
  await wait(() => versions[0] === 7, 'Cambio con una sesión desconectada');
  check(events[4] === before, 'Suscripción liberada no recibe cambios');
  let recovered = false;
  stops[4] = watchInventory(clients[4], fixture.home, () => { void clients[4].from('products').select('version').eq('id',product).single().then(({data}) => { recovered = Number(data?.version) === 7; }); }, () => {});
  await wait(() => recovered, 'Reconciliación después de reconectar'); check(recovered, 'Recupera cambios perdidos al suscribirse de nuevo');
  check(forbidden === 0, 'RLS impide notificaciones a un usuario ajeno');
  check((await ok(outsider.from('products').select('id').eq('household_id',fixture.home))).length === 0, 'Reconsulta ajena tampoco obtiene datos');
  await outsider.removeChannel(foreignChannel);
  console.log(`Realtime: ${passed} comprobaciones correctas. Latencias de escritura, evento y lectura: ${samples.join(', ')} ms.`);
} catch (error) { if (error.message?.startsWith('TIMEOUT:')) console.error(error.message); reportDatabaseError(error); }
finally {
  stops.forEach(stop => stop());
  await Promise.all(clients.map(client => client.removeAllChannels()));
  if (pool) { try { if (admin) await cleanupInventoryFixture(admin, pool, fixture); console.log('Datos y cuentas temporales eliminados.'); } catch (error) { reportDatabaseError(error); } finally { await pool.end(); } }
}
