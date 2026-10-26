import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runRemoveProductTests(query) {
  const actor = randomUUID(), outsider = randomUUID(), home = randomUUID(), foreignHome = randomUUID();
  let passed = 0;
  const check = (value, message) => { assert.ok(value,message); passed++; };
  const scalar = async (sql,args=[]) => Object.values((await query(sql,args)).rows[0])[0];
  const identity = async (user,role='authenticated') => {
    await query('reset role'); await query(`set local role ${role}`);
    await query("select set_config('request.jwt.claim.sub',$1,true)",[user || '']);
  };
  const fails = async (sql,args,code) => {
    await query('savepoint remove_failure'); let actual;
    try { await query(sql,args); } catch(error) { actual=error.code; }
    await query('rollback to savepoint remove_failure'); await query('release savepoint remove_failure');
    check(actual === code,`Eliminar producto: esperado ${code}, recibido ${actual}`);
  };
  const remove = 'select public.remove_product($1)';
  await query('begin');
  try {
    for(const id of [actor,outsider]) {
      await query('insert into auth.users(id,email) values ($1,$2)',[id,`${id}@example.invalid`]);
      await query("insert into public.profiles(id,display_name) values ($1,'Prueba de eliminación')",[id]);
    }
    await query("insert into public.households(id,name) values ($1,'Eliminación temporal'),($2,'Hogar ajeno')",[home,foreignHome]);
    await query("insert into public.household_members(household_id,user_id,role) values ($1,$2,'integrante'),($3,$4,'admin')",[home,actor,foreignHome,outsider]);
    await identity(actor);
    const category=await scalar("insert into public.categories(household_id,name,icon_id) values ($1,'Aseo','cleaning') returning id",[home]);
    const args=[home,category,'Bolsas de basura','','cleaning',10,randomUUID(),2];
    const create='select * from public.create_product_with_risk($1,$2,$3,$4,$5,$6,$7,$8)';
    const product=(await query(create,args)).rows[0].product_id;
    await query('select public.change_stock($1,$2,$3,$4,null)',[product,randomUUID(),'delta',1]);
    await query('select public.set_product_risk($1,3,1)',[product]);
    await identity(outsider); await fails(remove,[product],'42501');
    await identity(null,'anon'); await fails(remove,[product],'42501');
    await identity(actor); await fails(remove,[randomUUID()],'42501');
    await query(remove,[product]);
    const record=(await query('select * from public.products where id=$1',[product])).rows[0];
    check(record.deleted_at && record.deleted_by === actor,'Registrar fecha y autor de la eliminación');
    check(record.category_id === null,'Producto retirado no impide quitar la categoría');
    check(record.stock === 11 && Number(record.version) === 2 && record.risk_quantity === 3,'Conservar cantidades, umbral y versión final');
    check(await scalar('select count(*)::int from public.products where household_id=$1 and deleted_at is null',[home]) === 0,'Inventario activo excluye producto eliminado');
    check(await scalar('select count(*)::int from public.stock_movements where product_id=$1',[product]) === 2,'Historial completo permanece visible a integrantes');
    const timestamp=await scalar('select deleted_at::text from public.products where id=$1',[product]);
    await query(remove,[product]);
    check(await scalar('select deleted_at::text from public.products where id=$1',[product]) === timestamp,'Reintentar no cambia la baja');
    await fails('select public.change_stock($1,$2,$3,$4,null)',[product,randomUUID(),'delta',1],'PT410');
    await fails('select public.set_product_risk($1,4,2)',[product],'PT410');
    await query(create,args);
    check(await scalar('select count(*)::int from public.products where household_id=$1 and deleted_at is null',[home]) === 0,'Reintentar alta no resucita producto eliminado');
    await fails('delete from public.products where id=$1',[product],'42501');
    await query('select public.remove_category($1,$2,null)',[home,category]);
    check(await scalar('select count(*)::int from public.categories where id=$1',[category]) === 0,'Categoría puede quitarse tras retirar su último producto');
    check(await scalar('select count(*)::int from public.stock_movements where product_id=$1',[product]) === 2,'Quitar categoría tampoco borra historial');
    await identity(outsider);
    check(await scalar('select count(*)::int from public.products where id=$1',[product]) === 0,'Otro hogar no ve el producto archivado');
    check(await scalar('select count(*)::int from public.stock_movements where product_id=$1',[product]) === 0,'Otro hogar no ve sus movimientos');
    await fails(remove,[product],'42501');
    await query('reset role');
    await fails('update public.products set stock=99 where id=$1',[product],'PT410');
    console.log(`Eliminar productos SQL: ${passed} comprobaciones correctas; datos revertidos.`);
  } finally { await query('rollback'); }
}
