import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Se usa el mismo contrato SQL en PostgreSQL local embebido y Supabase.
// Todo este grupo se ejecuta dentro de una transacción que termina en ROLLBACK.
export async function runDatabaseTests(query) {
  const admin = randomUUID(), member = randomUUID(), outsider = randomUUID();
  const home = randomUUID(), otherHome = randomUUID();
  let passed = 0;
  const check = (condition, label) => { assert.ok(condition, label); passed++; };
  const scalar = async (sql, params = []) => Object.values((await query(sql, params)).rows[0])[0];
  const identity = async (id, role = 'authenticated') => {
    await query('reset role');
    await query(`set local role ${role}`); // Solo valores fijos definidos en esta prueba.
    await query("select set_config('request.jwt.claim.sub', $1, true)", [id || '']);
  };
  const fails = async (sql, params, code, label) => {
    await query('savepoint expected_failure');
    let actual;
    try { await query(sql, params); } catch (error) { actual = error.code; }
    await query('rollback to savepoint expected_failure');
    await query('release savepoint expected_failure');
    check(actual === code, `${label}: esperado ${code}, recibido ${actual || 'sin error'}`);
  };
  const adjust = (product, operation, kind, quantity, version = null) =>
    query('select * from public.change_stock($1,$2,$3,$4,$5)', [product, operation, kind, quantity, version]);
  const createArgs = [home, null, 'Comida del Logan Cannes', 'Bolsa de alimento', 'pet', 2, randomUUID()];

  await query('begin');
  try {
    for (const [id, label] of [[admin, 'Admin'], [member, 'Mamá'], [outsider, 'Ajeno']]) {
      await query('insert into auth.users(id,email) values ($1,$2)', [id, `${id}@example.invalid`]);
      await query('insert into public.profiles(id,display_name) values ($1,$2)', [id, label]);
    }
    await query("insert into public.households(id,name) values ($1,'Hogar de prueba'),($2,'Otro hogar')", [home, otherHome]);
    await query("insert into public.household_members(household_id,user_id,role) values ($1,$2,'admin'),($1,$3,'integrante'),($4,$5,'admin')", [home, admin, member, otherHome, outsider]);
    const foreignCategory = await scalar("insert into public.categories(household_id,name,icon_id,created_by) values ($1,'Ajena','other',$2) returning id", [otherHome, outsider]);
    await query("insert into public.household_invitations(household_id,email,invited_by,expires_at) values ($1,'pending@example.invalid',$2,now()+interval '1 day')", [home, admin]);

    await identity(member);
    check(await scalar('select count(*)::integer from public.households') === 1, 'Integrante solo ve su hogar');
    check(await scalar('select count(*)::integer from public.profiles') === 2, 'Perfiles limitados al hogar');
    check(await scalar('select count(*)::integer from public.household_members') === 2, 'Puede ver integrantes de su hogar');
    check(await scalar('select count(*)::integer from public.household_invitations') === 0, 'Integrante no ve invitaciones');
    check(await scalar('select count(*)::integer from public.icon_catalog') === 8, 'Catálogo de ocho iconos');
    const category = await scalar("insert into public.categories(household_id,name,icon_id) values ($1,'Mascotas','pet') returning id", [home]);
    createArgs[1] = category;
    check(Boolean(category), 'Integrante crea categorías');
    await fails("insert into public.categories(household_id,name,icon_id) values ($1,'Intrusa','pet')", [otherHome], '42501', 'No puede crear categoría ajena');
    await fails("insert into public.categories(household_id,name,icon_id,created_by) values ($1,'Autor falso','pet',$2)", [home, admin], '42501', 'No puede falsificar autor');
    await fails("insert into public.categories(household_id,name,icon_id) values ($1,'mascotas','pet')", [home], '23505', 'Categorías duplicadas sin diferencias de mayúsculas');
    await fails("insert into public.categories(household_id,name,icon_id) values ($1,'Error','inexistente')", [home], '23503', 'Solo iconos del catálogo');

    const createSql = 'select * from public.create_product($1,$2,$3,$4,$5,$6,$7)';
    const initial = (await query(createSql, createArgs)).rows[0];
    const product = initial.product_id;
    check(initial.new_stock === 2 && initial.previous_stock === 0, 'Alta guarda movimiento inicial');
    check(initial.actor_id === member && initial.actor_name === 'Mamá', 'Actor obtenido desde sesión y perfil');
    check((await query(createSql, createArgs)).rows[0].id === initial.id, 'Reintento de alta devuelve el mismo movimiento');
    await fails(createSql, [...createArgs.slice(0, 5), 3, createArgs[6]], '22023', 'Alta no reutiliza operación con otros datos');
    check(await scalar('select count(*)::integer from public.products') === 1, 'No duplica producto al reintentar');
    await fails(createSql, [home, foreignCategory, 'Cruce de hogar', '', 'other', 0, randomUUID()], '23503', 'Categoría debe pertenecer al mismo hogar');
    await fails(createSql, [otherHome, foreignCategory, 'Ajeno', '', 'other', 0, randomUUID()], '42501', 'No crea productos en otro hogar');
    await fails(createSql, [home, category, 'Negativo', '', 'other', -1, randomUUID()], '23514', 'Stock inicial no negativo');
    await fails(createSql, [home, category, ' ', '', 'other', 0, randomUUID()], '23514', 'Nombre vacío rechazado');
    await fails(createSql, [home, category, 'Largo', 'a'.repeat(241), 'other', 0, randomUUID()], '23514', 'Descripción breve');
    const zero = (await query(createSql, [home, category, 'Papel higiénico', '', 'paper', 0, randomUUID()])).rows[0];
    check(zero.new_stock === 0 && zero.delta === 0, 'Stock inicial cero también tiene historial');

    const operation = randomUUID();
    const changed = (await adjust(product, operation, 'delta', 1)).rows[0];
    check(changed.previous_stock === 2 && changed.new_stock === 3 && changed.delta === 1, 'Incremento correcto');
    check((await adjust(product, operation, 'delta', 1)).rows[0].id === changed.id, 'Reintento de delta no duplica movimiento');
    await fails('select public.change_stock($1,$2,$3,$4)', [product, operation, 'delta', 2], '22023', 'Operación no cambia de payload');
    await fails('select public.change_stock($1,$2,$3,$4)', [product, randomUUID(), 'delta', -4], '23514', 'No permite stock negativo');
    check(await scalar('select stock from public.products where id=$1', [product]) === 3, 'Error conserva stock');
    check(await scalar('select count(*)::integer from public.stock_movements where product_id=$1', [product]) === 2, 'Error no genera historial');
    await fails('select public.change_stock($1,$2,$3,$4,$5)', [product, randomUUID(), 'set', 8, 1], '40001', 'Detecta versión antigua en casilla');
    const absolute = (await adjust(product, randomUUID(), 'set', 8, 2)).rows[0];
    check(absolute.new_stock === 8 && Number(absolute.product_version) === 3, 'Cambio absoluto con versión vigente');
    check((await adjust(product, absolute.operation_id, 'set', 8, 2)).rows[0].id === absolute.id, 'Reintento absoluto se reconoce antes de validar versión');
    await fails('select public.change_stock($1,$2,$3,$4)', [product, randomUUID(), 'delta', 0], '22023', 'Delta cero rechazado');
    await fails('select public.change_stock($1,$2,$3,$4)', [product, randomUUID(), 'set', 9], '22023', 'Casilla requiere versión');
    await fails('select public.change_stock($1,$2,$3,$4)', [product, randomUUID(), 'delta', 2147483647], '23514', 'Evita desbordamiento de stock');

    // Fallo deliberado después del UPDATE de stock: toda la operación se revierte.
    await query('reset role');
    await query("create function pg_temp.reject_movement() returns trigger language plpgsql as $$ begin raise exception 'Fallo de auditoría simulado'; end; $$");
    await query('create trigger test_reject_movement before insert on public.stock_movements for each row execute function pg_temp.reject_movement()');
    await identity(member);
    await fails('select public.change_stock($1,$2,$3,$4)', [product, randomUUID(), 'delta', 1], 'P0001', 'Fallo del historial revierte actualización');
    check(await scalar('select stock from public.products where id=$1', [product]) === 8, 'Stock intacto si falla auditoría');
    check(Number(await scalar('select version from public.products where id=$1', [product])) === 3, 'Versión intacta si falla auditoría');
    const countBefore = await scalar('select count(*)::integer from public.products');
    await fails(createSql, [home, category, 'Alta que debe revertirse', '', 'other', 1, randomUUID()], 'P0001', 'Fallo de historial revierte alta');
    check(await scalar('select count(*)::integer from public.products') === countBefore, 'No queda producto sin movimiento inicial');
    await query('reset role');
    await query('drop trigger test_reject_movement on public.stock_movements');
    await identity(member);

    await fails('update public.products set stock=999 where id=$1', [product], '42501', 'No escribe stock directamente');
    await fails('insert into public.products(household_id,category_id,name,stock,created_by) values ($1,$2,$3,1,$4)', [home, category, 'Directo', member], '42501', 'Alta de productos no evita historial');
    await fails('update public.stock_movements set new_stock=999 where id=$1', [initial.id], '42501', 'Historial no editable');
    await fails('delete from public.stock_movements where id=$1', [initial.id], '42501', 'Historial no eliminable');
    await fails("update public.household_members set role='admin' where user_id=$1", [member], '42501', 'No eleva su rol');
    await fails("insert into public.household_members(household_id,user_id,role) values ($1,$2,'integrante')", [home, outsider], '42501', 'No añade integrantes directamente');
    await fails('select private.bootstrap_household($1,$2,$3)', [member, 'Intruso', 'Intruso'], '42501', 'Bootstrap no disponible para clientes');

    await identity(admin);
    check(await scalar('select count(*)::integer from public.household_invitations') === 1, 'Admin ve invitaciones de su hogar');
    check((await adjust(product, randomUUID(), 'delta', -1)).rows[0].new_stock === 7, 'Admin también ajusta inventario');
    check(Boolean(await scalar("insert into public.categories(household_id,name,icon_id) values ($1,'Aseo','cleaning') returning id", [home])), 'Admin también crea categorías');
    check(Boolean((await query(createSql, [home, category, 'Producto del admin', '', 'other', 0, randomUUID()])).rows[0].id), 'Admin también crea productos');
    await fails('update public.stock_movements set new_stock=0 where id=$1', [initial.id], '42501', 'Admin no reescribe historial');

    await identity(outsider);
    check(await scalar('select count(*)::integer from public.products') === 0, 'Ajeno no ve productos');
    check(await scalar('select count(*)::integer from public.stock_movements') === 0, 'Ajeno no ve movimientos');
    check(await scalar('select count(*)::integer from public.household_invitations') === 0, 'Admin ajeno no ve invitaciones');
    await fails('select public.change_stock($1,$2,$3,$4)', [product, randomUUID(), 'delta', 1], '42501', 'Ajeno no ajusta stock');

    // Comprobar que una expulsión deja de permitir lecturas y reintentos.
    await query('reset role');
    await query('delete from public.household_members where household_id=$1 and user_id=$2', [home, member]);
    await identity(member);
    check(await scalar('select count(*)::integer from public.stock_movements') === 0, 'Expulsado deja de ver historial');
    await fails('select public.change_stock($1,$2,$3,$4)', [product, operation, 'delta', 1], '42501', 'Expulsado no recupera movimiento reintentado');

    await identity(null, 'anon');
    await fails('select * from public.products', [], '42501', 'Anónimo no lee inventario');
    await fails(createSql, createArgs, '42501', 'Anónimo no ejecuta altas');
    await fails('select public.change_stock($1,$2,$3,$4)', [product, randomUUID(), 'delta', 1], '42501', 'Anónimo no ejecuta ajustes');

    await query('reset role');
    const freshAdmin = randomUUID();
    await query('insert into auth.users(id,email) values ($1,$2)', [freshAdmin, `${freshAdmin}@example.invalid`]);
    const bootstrapped = await scalar('select private.bootstrap_household($1,$2,$3)', [freshAdmin, 'Nuevo hogar', 'Nuevo admin']);
    check(Boolean(bootstrapped), 'Bootstrap administrativo crea hogar');
    check(await scalar("select role from public.household_members where household_id=$1 and user_id=$2", [bootstrapped, freshAdmin]) === 'admin', 'Bootstrap asigna admin');
    await fails('select private.bootstrap_household($1,$2,$3)', [freshAdmin, 'Duplicado', 'Admin'], '22023', 'Bootstrap evita alta accidental duplicada');
    check(await scalar("select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('icon_catalog','profiles','households','household_members','categories','products','stock_movements','household_invitations') and c.relrowsecurity") === 8, 'Todas las tablas tienen RLS');
    console.log(`SQL: ${passed} comprobaciones correctas; datos de prueba revertidos.`);
    return passed;
  } finally {
    await query('rollback');
  }
}
