import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { adminClient } from './supabase-management.mjs';
import { databaseConnection, reportDatabaseError } from './database-connection.mjs';
import { createInventoryFixture, cleanupInventoryFixture, loginFixture } from './inventory-test-fixture.mjs';
const fixture={users:[]}; let pool,admin,passed=0;
const check=(condition,label)=>{assert.ok(condition,label);passed++};
async function ok(query){const result=await query;if(result.error)throw result.error;return result.data;}
try{
 pool=databaseConnection();admin=await adminClient();await createInventoryFixture(admin,pool,fixture);
 const [owner,member,outsider]=await Promise.all(fixture.users.map(loginFixture));
 const category=await ok(member.from('categories').insert({household_id:fixture.home,name:'Mascotas',icon_id:'pet'}).select('id').single());
 check(Boolean(category.id),'Integrante crea categoría mediante API');
 const duplicate=await owner.from('categories').insert({household_id:fixture.home,name:'mascotas',icon_id:'pet'});
 check(duplicate.error?.code==='23505','Nombre duplicado se rechaza por API');
 const adminCategory=await ok(owner.from('categories').insert({household_id:fixture.home,name:'Aseo',icon_id:'paper'}).select('id').single());
 check(Boolean(adminCategory.id),'Admin crea categoría');
 const args={p_household_id:fixture.home,p_category_id:category.id,p_name:'Comida del Logan Cannes',p_description:'Bolsas completas',p_icon_id:'pet',p_initial_stock:2,p_operation_id:randomUUID()};
 const movement=await ok(member.rpc('create_product',args));
 check(movement.actor_id===fixture.users[1].id&&movement.new_stock===2,'Alta obtiene actor e inventario inicial de la sesión');
 const retry=await ok(member.rpc('create_product',args));check(retry.id===movement.id,'Reintento de alta conserva un movimiento');
 const zero=await ok(owner.rpc('create_product',{...args,p_category_id:adminCategory.id,p_name:'Papel higiénico',p_icon_id:'paper',p_initial_stock:0,p_operation_id:randomUUID()}));
 check(zero.new_stock===0,'Admin crea producto faltante');
 const all=await ok(member.from('products').select('id,name,stock,description,icon_id').eq('household_id',fixture.home));
 check(all.length===2&&all.some(row=>row.description==='Bolsas completas'&&row.icon_id==='pet'),'La lista devuelve nombres, descripciones e iconos reales');
 const forbidden=await ok(outsider.from('products').select('id').eq('household_id',fixture.home));check(forbidden.length===0,'Hogar ajeno permanece aislado');
 const product=movement.product_id;
 const delta=(client,id,quantity)=>client.rpc('change_stock',{p_product_id:product,p_operation_id:id,p_kind:'delta',p_quantity:quantity,p_expected_version:null});
 await Promise.all([ok(delta(owner,randomUUID(),1)),ok(delta(member,randomUUID(),1))]);
 let current=await ok(member.from('products').select('stock,version').eq('id',product).single());check(current.stock===4,'Ambos roles suman simultáneamente sin perder cambios');
 const operation=randomUUID();await ok(delta(member,operation,-1));await ok(delta(member,operation,-1));
 current=await ok(member.from('products').select('stock,version').eq('id',product).single());check(current.stock===3,'Reintentar un decremento no lo duplica');
 const conflict=await member.rpc('change_stock',{p_product_id:product,p_operation_id:randomUUID(),p_kind:'set',p_quantity:9,p_expected_version:1});check(conflict.error?.code==='PT409',`Casilla detecta una versión antigua (${conflict.error?.code || 'sin código'})`);check(conflict.status===409,'El conflicto responde HTTP 409, sin reintentos internos');
 await ok(owner.rpc('change_stock',{p_product_id:product,p_operation_id:randomUUID(),p_kind:'set',p_quantity:0,p_expected_version:current.version}));
 check((await ok(owner.from('products').select('stock').eq('id',product).single())).stock===0,'Casilla guarda cantidad absoluta');
 const negative=await delta(member,randomUUID(),-1);check(negative.error?.code==='23514','No permite cantidades negativas');
 const bypass=await member.from('products').update({stock:7}).eq('id',product);check(bypass.error?.code==='42501','No se puede saltar la auditoría');
 const history=await ok(member.from('stock_movements').select('id,actor_name,product_name,previous_stock,new_stock,delta').eq('product_id',product));
 check(history.length===5,'Cada operación confirmada genera exactamente un movimiento');
 check(history.reduce((total,row)=>total+row.delta,0)===0,'Suma del historial coincide con el stock final');
 check(history.every(row=>row.actor_name&&row.product_name==='Comida del Logan Cannes'),'Historial incluye autor y nombre del producto');
 for(let index=0;index<22;index++)await ok(delta(member,randomUUID(),index%2===0?1:-1));
 const first=await ok(member.from('stock_movements').select('id,created_at').eq('household_id',fixture.home).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(21));
 check(first.length===21,'El historial puede cargar más de una página');
 const cursor=first[19];
 const next=await ok(member.from('stock_movements').select('id,created_at').eq('household_id',fixture.home).order('created_at',{ascending:false}).order('id',{ascending:false}).or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`).limit(21));
 check(new Set([...first.slice(0,20),...next].map(row=>row.id)).size===28,'Paginación por cursor conserva todos los movimientos sin duplicar');
 const privateHistory=await ok(outsider.from('stock_movements').select('id').eq('household_id',fixture.home));check(privateHistory.length===0,'El historial no se filtra a otro hogar');
 console.log(`Inventario HTTP: ${passed} comprobaciones correctas con cuentas admin e integrante reales.`);
}catch(error){reportDatabaseError(error)}finally{
 if(pool){try{if(admin)await cleanupInventoryFixture(admin,pool,fixture);console.log('Hogares, productos y cuentas temporales eliminados.')}catch(error){reportDatabaseError(error)}finally{await pool.end()}}
}
