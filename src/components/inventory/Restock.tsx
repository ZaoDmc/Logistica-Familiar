import { useState } from 'react';
import { filterProducts, stockStatus, type Category, type Mutation, type Product } from '../../lib/inventory-model';
import { ProductCard } from './ProductCard';

export function Restock({ products, categories, disabled, mutate, showHistory }: {
  products: Product[]; categories: Category[]; disabled: boolean;
  mutate: (intent: Mutation) => Promise<void>; showHistory: (product: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'warning' | 'missing'>('all'), [search, setSearch] = useState('');
  const missing = products.filter(item => stockStatus(item) === 'missing').length;
  const warning = products.filter(item => stockStatus(item) === 'warning').length;
  const visible = filterProducts(products, categories, search, '', false)
    .filter(item => stockStatus(item) !== 'available' && (filter === 'all' || stockStatus(item) === filter))
    .sort((a, b) => Number(stockStatus(a) !== 'missing') - Number(stockStatus(b) !== 'missing'));
  return <section aria-labelledby="restock-title">
    <div className="restock-heading"><h2 id="restock-title">Reposición del hogar</h2><p>Revisemos qué está por agotarse y qué falta comprar. Puedes contar y ajustar las cantidades aquí mismo.</p></div>
    <div className="risk-summary" aria-label="Resumen de reposición"><div className="missing"><strong>{missing}</strong><span>Por comprar · stock en cero</span></div><div className="warning"><strong>{warning}</strong><span>Por agotarse · en el límite o debajo</span></div></div>
    <label htmlFor="restock-search">Buscar en reposición</label><input id="restock-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Producto, marca o categoría" />
    <div className="restock-filters" role="group" aria-label="Estado de reposición">{([['all','Todos'],['missing','Por comprar'],['warning','Por agotarse']] as const).map(([value,label]) => <button type="button" key={value} className="secondary" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <p className="small" role="status">{visible.length} {visible.length === 1 ? 'producto para revisar' : 'productos para revisar'}</p>
    <div className="product-grid">{visible.map(product => <div className="restock-product" key={product.id}><p className="small">{categories.find(item => item.id === product.category_id)?.name}</p><ProductCard showPurchaseQuantity product={product} disabled={disabled} mutate={mutate} showHistory={() => showHistory(product.id)} /></div>)}</div>
    {!visible.length && <div className="card empty-state"><h3>{missing + warning ? 'No hay productos con esta selección' : 'Por ahora estamos al día'}</h3><p>{missing + warning ? 'Prueba otro texto o cambia el filtro.' : 'Aquí aparecerán los productos en cero o con stock positivo igual o menor a su cantidad en riesgo.'}</p></div>}
  </section>;
}
