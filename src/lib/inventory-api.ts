import { supabase } from './supabase';
import type { Category, Product, Movement, Mutation } from './inventory-model';

export class InventoryError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
export function inventoryError(error: unknown): InventoryError {
  if (error instanceof InventoryError) return error;
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    '40001': 'La cantidad cambió en otra sesión. Revisa el stock actual antes de guardar.',
    'PT409': 'La cantidad cambió en otra sesión. Revisa el stock actual antes de guardar.',
    'PT412': 'La cantidad en riesgo cambió en otra sesión. Revisa el valor actual antes de guardar.',
    '23514': 'La cantidad debe ser un entero entre 0 y 1.000.000.',
    '23505': 'Ya existe una categoría con ese nombre en el hogar.',
    '42501': 'Ya no tienes acceso a esta operación. Actualiza o vuelve a iniciar sesión.',
    '23503': 'La categoría ya no está disponible. Actualiza la lista.',
    '23502': 'Completa los campos obligatorios.',
    'P0001': 'Esta categoría tiene productos. Elige otra categoría para conservarlos antes de quitarla.',
    '22023': 'No se pudo validar la operación. Actualiza y revisa los datos.',
    'PGRST301': 'Tu sesión venció. Vuelve a iniciar sesión.',
  };
  return new InventoryError(code, messages[code] || 'No pudimos confirmar la operación. Revisa tu conexión.');
}
export function isDefiniteError(error: InventoryError) {
  return ['40001', 'PT409', 'PT412', '23514', '23505', '42501', '23503', '23502', '22023', 'PGRST301', 'P0001'].includes(error.code);
}
function client() { if (!supabase) throw new InventoryError('CONFIG', 'Falta la conexión al hogar.'); return supabase; }
async function allRows<T extends { id: string }>(table: string, fields: string, home: string): Promise<T[]> {
  const rows: T[] = []; let after = '';
  while (true) {
    let query = client().from(table).select(fields).eq('household_id', home).order('id').limit(500);
    if (after) query = query.gt('id', after);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(15000));
    if (error) throw inventoryError(error);
    const page = data as unknown as T[];
    rows.push(...page);
    if (page.length < 500) return rows;
    after = page[page.length - 1].id;
  }
}
export async function getInventory(home: string) {
  const [categories, products] = await Promise.all([
    allRows<Category>('categories', 'id,name,icon_id', home),
    allRows<Product>('products', 'id,category_id,name,description,icon_id,stock,version,risk_quantity,risk_version', home),
  ]);
  categories.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return { categories, products, updatedAt: new Date() };
}
export async function applyMutation(home: string, mutation: Mutation) {
  const db = client();
  const signal = AbortSignal.timeout(15000);
  const query = mutation.type === 'category'
    ? db.from('categories').insert({ household_id: home, name: mutation.name.trim(), icon_id: mutation.icon_id }).select('id').abortSignal(signal).single()
    : mutation.type === 'remove-category'
      ? db.rpc('remove_category', { p_household_id: home, p_category_id: mutation.category_id, p_destination_id: mutation.destination_id }).abortSignal(signal)
    : mutation.type === 'risk'
      ? db.rpc('set_product_risk', { p_product_id: mutation.product_id, p_risk_quantity: mutation.quantity, p_expected_version: mutation.version }).abortSignal(signal)
    : mutation.type === 'product'
      ? db.rpc(mutation.product.risk_quantity === undefined ? 'create_product' : 'create_product_with_risk', { p_household_id: home, p_category_id: mutation.product.category_id,
        p_name: mutation.product.name.trim(), p_description: mutation.product.description.trim(), p_icon_id: mutation.product.icon_id,
        p_initial_stock: mutation.product.stock, p_operation_id: mutation.operation_id,
        ...(mutation.product.risk_quantity === undefined ? {} : { p_risk_quantity: mutation.product.risk_quantity }) }).abortSignal(signal)
      : db.rpc('change_stock', { p_product_id: mutation.product_id, p_operation_id: mutation.operation_id,
        p_kind: mutation.kind, p_quantity: mutation.quantity, p_expected_version: mutation.version }).abortSignal(signal);
  const { error } = await query;
  if (error) throw inventoryError(error);
}
export async function getMovements(home: string, product: string, after?: Movement) {
  let query = client().from('stock_movements').select('id,product_id,actor_name,product_name,kind,previous_stock,new_stock,delta,created_at,product_version')
    .eq('household_id', home).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(21);
  if (product) query = query.eq('product_id', product);
  if (after) query = query.or(`created_at.lt.${after.created_at},and(created_at.eq.${after.created_at},id.lt.${after.id})`);
  const { data, error } = await query.abortSignal(AbortSignal.timeout(15000));
  if (error) throw inventoryError(error);
  return { rows: (data as Movement[]).slice(0, 20), more: data.length > 20 };
}
