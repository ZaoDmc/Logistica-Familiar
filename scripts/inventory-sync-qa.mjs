// Escritura desde otra sesión para revisar la UI con el hogar temporal de inventory:qa.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { loginFixture } from './inventory-test-fixture.mjs';
const fixture = JSON.parse(readFileSync(new URL('../.inventory-qa.local', import.meta.url), 'utf8'));
const user = fixture.users.find(user => user.role === 'admin');
if (!/^phase3-[a-f0-9-]+@example\.invalid$/.test(user?.email || '')) throw new Error('UNEXPECTED_FIXTURE');
const client = await loginFixture(user);
try {
  const {data:home,error:homeError} = await client.from('households').select('name').eq('id',fixture.home).single();
  if (homeError || home?.name !== 'Hogar de prueba fase 3') throw new Error('UNEXPECTED_FIXTURE');
  const {data,error} = await client.from('products').select('id').eq('household_id',fixture.home).eq('name','Crema de leche Soprole').single();
  if (error) throw new Error('MISSING_FIXTURE_PRODUCT');
  const result = await client.rpc('change_stock',{p_product_id:data.id,p_operation_id:randomUUID(),p_kind:'delta',p_quantity:1,p_expected_version:null});
  if (result.error) throw new Error('QA_WRITE_FAILED');
  console.log('Otra sesión confirmó un incremento en el hogar temporal.');
} finally { await client.removeAllChannels(); }
