import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runConcurrencyTests(pool) {
  const actor = randomUUID(), home = randomUUID();
  let created = false;
  const setup = await pool.connect();
  let product;
  try {
    await setup.query('begin');
    await setup.query('insert into auth.users(id,email) values ($1,$2)', [actor, `${actor}@example.invalid`]);
    await setup.query("insert into public.profiles(id,display_name) values ($1,'Prueba simultánea')", [actor]);
    await setup.query("insert into public.households(id,name) values ($1,'Prueba temporal de concurrencia')", [home]);
    await setup.query("insert into public.household_members(household_id,user_id,role) values ($1,$2,'integrante')", [home, actor]);
    const category = (await setup.query("insert into public.categories(household_id,name,icon_id,created_by) values ($1,'Pruebas','other',$2) returning id", [home, actor])).rows[0].id;
    await setup.query('set local role authenticated');
    await setup.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    product = (await setup.query('select * from public.create_product($1,$2,$3,$4,$5,$6,$7)', [home, category, 'Producto temporal', '', 'other', 0, randomUUID()])).rows[0].product_id;
    await setup.query('commit');
    created = true;
  } catch (error) {
    await setup.query('rollback');
    throw error;
  } finally { setup.release(); }

  const change = async (operation, kind, quantity, version = null) => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
      const result = await client.query('select * from public.change_stock($1,$2,$3,$4,$5)', [product, operation, kind, quantity, version]);
      await client.query('commit');
      return result.rows[0];
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  };
  const current = async () => (await pool.query('select stock,version from public.products where id=$1', [product])).rows[0];
  try {
    // Cinco conexiones distintas compiten por el mismo producto.
    const increments = await Promise.allSettled(Array.from({ length: 5 }, () => change(randomUUID(), 'delta', 1)));
    assert.ok(increments.every(result => result.status === 'fulfilled'), 'Los cinco incrementos terminan correctamente');
    assert.equal((await current()).stock, 5, 'Se conservan cinco incrementos simultáneos');
    const retryId = randomUUID();
    const retryResults = await Promise.allSettled(Array.from({ length: 5 }, () => change(retryId, 'delta', 1)));
    assert.ok(retryResults.every(result => result.status === 'fulfilled'), 'Los reintentos terminan correctamente');
    const retries = retryResults.map(result => result.value);
    assert.equal(new Set(retries.map(row => row.id)).size, 1, 'Cinco reintentos devuelven un movimiento');
    assert.equal((await current()).stock, 6, 'Reintentos suman una sola unidad');

    let state = await current();
    const races = await Promise.allSettled([change(randomUUID(), 'set', 1, state.version), change(randomUUID(), 'set', 2, state.version)]);
    assert.equal(races.filter(result => result.status === 'fulfilled').length, 1, 'Una escritura absoluta gana');
    assert.ok(races.some(result => result.status === 'rejected' && result.reason.code === 'PT409'), 'La otra detecta versión obsoleta');
    state = await current();
    await change(randomUUID(), 'set', 1, state.version);
    const decrements = await Promise.allSettled([change(randomUUID(), 'delta', -1), change(randomUUID(), 'delta', -1)]);
    assert.equal(decrements.filter(result => result.status === 'fulfilled').length, 1, 'Solo un decremento desde uno');
    assert.ok(decrements.some(result => result.status === 'rejected' && result.reason.code === '23514'), 'El otro no produce negativo');
    assert.equal((await current()).stock, 0);
    const integrity = (await pool.query(`select count(*)::integer as movements,
      count(distinct product_version)::integer as versions, sum(delta)::integer as total
      from public.stock_movements where product_id=$1`, [product])).rows[0];
    assert.equal(integrity.total, 0, 'Suma de historial coincide con stock final');
    assert.equal(integrity.movements, Number((await current()).version), 'Cada versión tiene un movimiento');
    assert.equal(integrity.versions, integrity.movements, 'No hay versiones duplicadas');
    const riskChange = async quantity => {
      const client = await pool.connect();
      try {
        await client.query('begin'); await client.query('set local role authenticated');
        await client.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
        await client.query('select public.set_product_risk($1,$2,1)', [product,quantity]);
        await client.query('commit');
      } catch(error) { await client.query('rollback'); throw error; }
      finally { client.release(); }
    };
    const limits = await Promise.allSettled([riskChange(2),riskChange(3)]);
    assert.equal(limits.filter(result => result.status === 'fulfilled').length,1,'Solo un límite gana con la misma versión');
    assert.ok(limits.some(result => result.status === 'rejected' && result.reason.code === 'PT412'),'El otro límite detecta conflicto');
    const risk = (await pool.query('select stock,version,risk_quantity,risk_version from public.products where id=$1',[product])).rows[0];
    await riskChange(risk.risk_quantity);
    assert.equal(Number((await pool.query('select risk_version from public.products where id=$1',[product])).rows[0].risk_version),2,'Reintentar ganador no incrementa versión');
    assert.equal(risk.stock,0,'Competir por el límite conserva stock');
    assert.equal(Number(risk.version),integrity.movements,'Versión de stock sigue coincidiendo con historial');
    const remove = async () => {
      const client = await pool.connect();
      try {
        await client.query('begin'); await client.query('set local role authenticated');
        await client.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
        await client.query('select public.remove_product($1)',[product]); await client.query('commit');
      } catch(error) { await client.query('rollback'); throw error; }
      finally { client.release(); }
    };
    const deletion = await Promise.allSettled([remove(),change(randomUUID(),'delta',1)]);
    assert.equal(deletion[0].status,'fulfilled','Eliminar concluye aunque compita con stock');
    assert.ok(deletion[1].status === 'fulfilled' || deletion[1].reason.code === 'PT410','Stock confirma antes de la baja o se rechaza después');
    const archived = (await pool.query('select stock,version,deleted_at from public.products where id=$1',[product])).rows[0];
    const last = (await pool.query('select new_stock,product_version from public.stock_movements where product_id=$1 order by product_version desc limit 1',[product])).rows[0];
    assert.ok(archived.deleted_at && archived.stock === last.new_stock && Number(archived.version) === Number(last.product_version),'Eliminar y stock conservan el último movimiento sin desajustes');
    console.log('Concurrencia: incrementos, reintentos, casilla y decrementos correctos con hasta cinco sesiones.');
    console.log('Concurrencia de riesgo: conflicto de versiones y reintento correctos, sin alterar stock.');
    console.log('Concurrencia de eliminación: baja y actualización de stock conservan integridad.');
  } finally {
    if (created) {
      const cleanup = await pool.connect();
      try {
        await cleanup.query('begin');
        for (const table of ['stock_movements', 'products', 'categories', 'household_invitations', 'household_members']) {
          await cleanup.query(`delete from public.${table} where household_id=$1`, [home]);
        }
        await cleanup.query('delete from public.households where id=$1', [home]);
        await cleanup.query('delete from public.profiles where id=$1', [actor]);
        await cleanup.query('delete from auth.users where id=$1', [actor]);
        await cleanup.query('commit');
        console.log('Datos temporales de concurrencia eliminados.');
      } catch (error) {
        await cleanup.query('rollback');
        console.error(`No se pudieron limpiar los datos temporales del hogar ${home}; usuario de prueba ${actor}.`);
        throw error;
      } finally { cleanup.release(); }
    }
  }
}
