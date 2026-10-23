import type { ProductIconId } from '../catalogs/icons';

export type Category = { id: string; name: string; icon_id: ProductIconId };
export type Product = { id: string; category_id: string; name: string; description: string; icon_id: ProductIconId; stock: number; version: number | string };
export type Movement = { id: string; product_id: string; actor_name: string; product_name: string; kind: 'initial' | 'delta' | 'set'; previous_stock: number; new_stock: number; delta: number; created_at: string; product_version: number | string };
export type NewProduct = { category_id: string; name: string; description: string; icon_id: ProductIconId; stock: number };
export type Mutation =
  | { type: 'category'; name: string; icon_id: ProductIconId }
  | { type: 'remove-category'; category_id: string; destination_id: string | null }
  | { type: 'product'; operation_id: string; product: NewProduct }
  | { type: 'stock'; operation_id: string; product_id: string; kind: 'delta' | 'set'; quantity: number; version: number | string | null };

export function parseStock(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= 1000000 ? number : null;
}
export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}
export function filterProducts(products: Product[], categories: Category[], search: string, category: string, buying: boolean) {
  const words = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const categoryNames = new Map(categories.map(category => [category.id, category.name]));
  return products.filter(product => {
    const text = normalizeSearch(`${product.name} ${product.description} ${categoryNames.get(product.category_id) || ''}`);
    return (!category || product.category_id === category) && (!buying || product.stock === 0) && words.every(word => text.includes(word));
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
export function isMutation(value: unknown): value is Mutation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const uuid = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
  const icon = (value: unknown) => ['food', 'dairy', 'produce', 'cleaning', 'pet', 'paper', 'hygiene', 'other'].includes(String(value));
  if (item.type === 'category') return typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 80 && icon(item.icon_id);
  if (item.type === 'remove-category') return uuid(item.category_id) && (item.destination_id === null || (uuid(item.destination_id) && item.destination_id !== item.category_id));
  if (!uuid(item.operation_id)) return false;
  if (item.type === 'stock') return uuid(item.product_id) && typeof item.quantity === 'number' && Number.isSafeInteger(item.quantity)
    && ((item.kind === 'delta' && [1, -1].includes(item.quantity) && item.version === null)
      || (item.kind === 'set' && parseStock(String(item.quantity)) !== null && /^\d+$/.test(String(item.version)) && Number(item.version) > 0));
  if (item.type !== 'product' || !item.product || typeof item.product !== 'object') return false;
  const product = item.product as Record<string, unknown>;
  return uuid(product.category_id) && typeof product.name === 'string' && product.name.trim().length > 0 && product.name.length <= 100
    && typeof product.description === 'string' && product.description.length <= 240 && icon(product.icon_id)
    && typeof product.stock === 'number' && parseStock(String(product.stock)) !== null;
}
