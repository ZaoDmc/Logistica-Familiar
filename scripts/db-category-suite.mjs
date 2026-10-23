import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runCategoryDatabaseTests(query) {
  const actor = randomUUID(), outsider = randomUUID(), home = randomUUID(), foreignHome = randomUUID();
  let passed = 0;
  const check = (value, message) => { assert.ok(value, message); passed++; };
  const scalar = async (sql, params = []) => Object.values((await query(sql, params)).rows[0])[0];
  const identity = async (id, role = 'authenticated') => {
    await query('reset role'); await query(`set local role ${role}`);
    await query("select set_config('request.jwt.claim.sub',$1,true)", [id || '']);
  };
  const fails = async (args, code) => {
    await query('savepoint category_failure'); let actual;
    try { await query('select public.remove_category($1,$2,$3)', args); } catch (error) { actual = error.code; }
    await query('rollback to savepoint category_failure'); await query('release savepoint category_failure');
    check(actual === code, `Quitar categoría: esperado ${code}, recibido ${actual}`);
  };
  await query('begin');
  try {
    for (const id of [actor, outsider]) {
      await query('insert into auth.users(id,email) values ($1,$2)', [id, `${id}@example.invalid`]);
      await query("insert into public.profiles(id,display_name) values ($1,'Prueba de categorías')", [id]);
    }
    await query("insert into public.households(id,name) values ($1,'Categorías temporales'),($2,'Hogar ajeno')", [home, foreignHome]);
    await query("insert into public.household_members(household_id,user_id,role) values ($1,$2,'integrante'),($3,$4,'admin')", [home, actor, foreignHome, outsider]);
    const add = (house, name, user) => scalar("insert into public.categories(household_id,name,icon_id,created_by) values ($1,$2,'other',$3) returning id", [house, name, user]);
    const source = await add(home, 'Origen', actor), target = await add(home, 'Destino', actor);
    const empty = await add(home, 'Vacía', actor), foreign = await add(foreignHome, 'Ajena', outsider);
    await identity(actor);
    const initial = (await query('select * from public.create_product($1,$2,$3,$4,$5,$6,$7)', [home, source, 'Comida del Logan', '', 'pet', 7, randomUUID()])).rows[0];
    await fails([home, source, null], 'P0001');
    await fails([home, source, source], '22023');
    await fails([home, source, foreign], '23503');
    await fails([home, source, randomUUID()], '23503');
    check(await scalar('select category_id from public.products where id=$1', [initial.product_id]) === source, 'Errores conservan categoría original');
    await identity(outsider);
    await fails([home, source, target], '42501');
    await identity(null, 'anon'); await fails([home, source, target], '42501');
    await identity(actor);
    await query('select public.remove_category($1,$2,$3)', [home, source, target]);
    const product = (await query('select * from public.products where id=$1', [initial.product_id])).rows[0];
    check(product.category_id === target && product.stock === 7 && Number(product.version) === 1, 'Traslado conserva producto, cantidad y versión de stock');
    check(await scalar('select count(*)::int from public.stock_movements where product_id=$1', [initial.product_id]) === 1, 'Historial permanece intacto');
    check(await scalar('select count(*)::int from public.categories where id=$1', [source]) === 0, 'Integrante puede quitar categoría');
    await query('select public.remove_category($1,$2,$3)', [home, source, target]);
    check(await scalar('select count(*)::int from public.products where id=$1', [initial.product_id]) === 1, 'Reintentar no duplica ni borra productos');
    await query('select public.remove_category($1,$2,null)', [home, empty]);
    check(await scalar('select count(*)::int from public.categories where id=$1', [empty]) === 0, 'Vacía se quita sin destino');
    // La pantalla puede haberla visto vacía antes de una inserción concurrente.
    await fails([home, target, null], 'P0001');
    const adjusted = (await query('select * from public.change_stock($1,$2,$3,$4,$5)', [initial.product_id, randomUUID(), 'delta', 1, null])).rows[0];
    check(adjusted.new_stock === 8, 'Stock se sigue actualizando después del traslado');
    await identity(outsider);
    check(await scalar('select count(*)::int from public.categories where id=$1', [foreign]) === 1, 'Categoría ajena no se toca');
    console.log(`Categorías SQL: ${passed} comprobaciones correctas; datos revertidos.`);
  } finally { await query('rollback'); }
}
