import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { adminClient } from './supabase-management.mjs';
import { databaseConnection, reportDatabaseError } from './database-connection.mjs';
import { createInventoryFixture, cleanupInventoryFixture, loginFixture } from './inventory-test-fixture.mjs';
const file = new URL('../.inventory-qa.local', import.meta.url);
let pool, admin;
try {
  pool=databaseConnection(); admin=await adminClient();
  if (process.argv[2] === 'cleanup') {
    if (existsSync(file)) { await cleanupInventoryFixture(admin,pool,JSON.parse(readFileSync(file,'utf8'))); unlinkSync(file); }
    console.log('Datos de prueba visual eliminados.');
  } else {
    if (existsSync(file)) throw Object.assign(new Error(),{code:'QA_FIXTURE_ALREADY_EXISTS'});
    const fixture={users:[]}; const save=()=>writeFileSync(file,JSON.stringify(fixture)); save();
    try {
      await createInventoryFixture(admin,pool,fixture,save);
      const client=await loginFixture(fixture.users[0]);
      for (const [category,icon,name,description,stock] of [
        ['Alimentos','dairy','Crema de leche Soprole','Envases de 200 ml',2],
        ['Mascotas','pet','Comida del Logan Cannes','Bolsas de alimento',1],
        ['Aseo','paper','Papel higiénico','Paquetes de doce rollos',0],
      ]) {
        const result=await client.from('categories').insert({household_id:fixture.home,name:category,icon_id:icon}).select('id').single(); if(result.error)throw result.error;
        const product=await client.rpc('create_product_with_risk',{p_household_id:fixture.home,p_category_id:result.data.id,p_name:name,p_description:description,p_icon_id:icon,p_initial_stock:stock,p_operation_id:randomUUID(),p_risk_quantity:category === 'Alimentos' ? 2 : 0}); if(product.error)throw product.error;
      }
      console.log('Hogar de prueba visual preparado. Credenciales temporales en .inventory-qa.local, excluido de Git.');
    } catch(error) { await cleanupInventoryFixture(admin,pool,fixture); unlinkSync(file); throw error; }
  }
} catch(error){reportDatabaseError(error)}finally{if(pool)await pool.end()}
