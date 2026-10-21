import { createHash } from 'node:crypto';
import { databaseConnection, reportDatabaseError } from './database-connection.mjs';

const [home, actor] = process.argv.slice(2);
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
let pool;
try {
  if (!isUuid(home) || !isUuid(actor)) throw new Error('Usa npm run db:seed -- UUID_HOGAR UUID_USUARIO');
  pool = databaseConnection();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    for (const [categoryName, icon, productName, description, stock] of [
      ['Alimentos', 'dairy', 'Crema de leche Soprole', 'Envases disponibles', 2],
      ['Mascotas', 'pet', 'Comida del Logan Cannes', 'Bolsas de alimento', 1],
      ['Aseo', 'paper', 'Papel higiénico', 'Paquetes disponibles', 0],
    ]) {
      let category = (await client.query('select id from public.categories where household_id=$1 and lower(btrim(name))=lower($2)', [home, categoryName])).rows[0]?.id;
      if (!category) category = (await client.query('insert into public.categories(household_id,name,icon_id) values ($1,$2,$3) returning id', [home, categoryName, icon])).rows[0].id;
      const hash = createHash('sha256').update(`demo/${home}/${productName}`).digest('hex').slice(0, 32);
      const operation = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
      await client.query('select public.create_product($1,$2,$3,$4,$5,$6,$7)', [home, category, productName, description, icon, stock, operation]);
    }
    await client.query('commit');
    console.log('Tres productos de ejemplo preparados. Repetir con el mismo usuario no duplica productos ni reinicia el stock.');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
} catch (error) { reportDatabaseError(error); }
finally { if (pool) await pool.end(); }
