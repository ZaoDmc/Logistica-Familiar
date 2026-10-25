import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runRiskDatabaseTests(query) {
  const actor = randomUUID(), outsider = randomUUID(), home = randomUUID(), foreignHome = randomUUID();
  let passed = 0;
  const check = (value, message) => { assert.ok(value, message); passed++; };
  const scalar = async (sql, args = []) => Object.values((await query(sql, args)).rows[0])[0];
  const identity = async (user, role = 'authenticated') => {
    await query('reset role'); await query(`set local role ${role}`);
    await query("select set_config('request.jwt.claim.sub',$1,true)", [user || '']);
  };
  const fails = async (sql, args, code) => {
    await query('savepoint risk_failure'); let actual;
    try { await query(sql, args); } catch (error) { actual = error.code; }
    await query('rollback to savepoint risk_failure'); await query('release savepoint risk_failure');
    check(actual === code, `Riesgo: esperado ${code}, recibido ${actual}`);
  };
  const create = 'select * from public.create_product_with_risk($1,$2,$3,$4,$5,$6,$7,$8)';
  const set = 'select public.set_product_risk($1,$2,$3)';
  await query('begin');
  try {
    for (const id of [actor, outsider]) {
      await query('insert into auth.users(id,email) values ($1,$2)', [id, `${id}@example.invalid`]);
      await query("insert into public.profiles(id,display_name) values ($1,'Prueba de riesgo')", [id]);
    }
    await query("insert into public.households(id,name) values ($1,'Riesgo temporal'),($2,'Hogar ajeno')", [home, foreignHome]);
    await query("insert into public.household_members(household_id,user_id,role) values ($1,$2,'integrante'),($3,$4,'admin')", [home, actor, foreignHome, outsider]);
    await identity(actor);
    const category = await scalar("insert into public.categories(household_id,name,icon_id) values ($1,'Aseo','cleaning') returning id", [home]);
    const args = [home, category, 'Bolsas de basura', 'Paquetes', 'cleaning', 10, randomUUID(), 2];
    const initial = (await query(create, args)).rows[0];
    let product = (await query('select * from public.products where id=$1', [initial.product_id])).rows[0];
    check(product.stock === 10 && product.risk_quantity === 2, 'Alta guarda stock y límite atómicamente');
    check((await query(create, args)).rows[0].id === initial.id, 'Reintento de alta no duplica producto');
    await fails(create, [...args.slice(0, 7), 3], '22023');
    await fails(create, [...args.slice(0, 6), randomUUID(), -1], '23514');
    await fails(create, [...args.slice(0, 6), randomUUID(), 1000001], '23514');
    check(await scalar('select count(*)::int from public.products where household_id=$1', [home]) === 1, 'Altas inválidas no dejan productos parciales');
    await query(set, [product.id, 4, 1]);
    await query(set, [product.id, 4, 1]);
    product = (await query('select * from public.products where id=$1', [product.id])).rows[0];
    check(product.risk_quantity === 4 && Number(product.risk_version) === 2, 'Reintento del límite solo avanza una versión');
    check(product.stock === 10 && Number(product.version) === 1, 'Límite no altera stock ni su versión');
    check(await scalar('select count(*)::int from public.stock_movements where product_id=$1', [product.id]) === 1, 'Límite no agrega movimientos ficticios');
    await query(create, args);
    check(await scalar('select risk_quantity from public.products where id=$1', [product.id]) === 4, 'Reintentar alta no pisa el límite editado');
    await fails(set, [product.id, 5, 1], 'PT412');
    await fails(set, [product.id, -1, 2], '22023');
    await fails(set, [product.id, 1000001, 2], '22023');
    await fails(set, [product.id, null, 2], '22023');
    await fails(set, [product.id, 2, null], '22023');
    await query(set, [product.id, 0, 2]);
    check(await scalar('select risk_quantity from public.products where id=$1', [product.id]) === 0, 'Límite cero válido');
    await fails(set, [product.id, 4, 1], 'PT412');
    await fails('update public.products set risk_quantity=8 where id=$1', [product.id], '42501');
    const legacy = (await query('select * from public.create_product($1,$2,$3,$4,$5,$6,$7)', [...args.slice(0, 6), randomUUID()])).rows[0];
    check(await scalar('select risk_quantity from public.products where id=$1', [legacy.product_id]) === 0, 'Clientes anteriores conservan alta con riesgo cero');
    await identity(outsider);
    await fails(set, [product.id, 8, 3], '42501');
    await fails(create, [...args.slice(0, 6), randomUUID(), 2], '42501');
    await identity(null, 'anon');
    await fails(set, [product.id, 8, 3], '42501');
    await fails(create, [...args.slice(0, 6), randomUUID(), 2], '42501');
    console.log(`Riesgo SQL: ${passed} comprobaciones correctas; datos revertidos.`);
  } finally { await query('rollback'); }
}
