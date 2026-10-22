import { useState } from 'react';
import { productIcons } from '../../catalogs/icons';
import { useInventory } from '../../hooks/useInventory';
import { filterProducts } from '../../lib/inventory-model';
import { InventoryForm } from './InventoryForms';
import { ProductCard } from './ProductCard';
import { MovementHistory } from './MovementHistory';

export function Inventory({ home, userId, view, showHistory, historyProduct, setHistoryProduct }: {
  home: string; userId: string; view: 'products' | 'history' | 'members'; showHistory: (product: string) => void;
  historyProduct: string; setHistoryProduct: (value: string) => void;
}) {
  const state = useInventory(home, userId);
  const [form, setForm] = useState<'category' | 'product' | null>(null), [search, setSearch] = useState('');
  const [category, setCategory] = useState(''), [buying, setBuying] = useState(false);
  const categories = state.snapshot?.categories || [], products = state.snapshot?.products || [];
  const filtered = filterProducts(products, categories, search, category, buying);
  const groups = categories.filter(item => (!category || item.id === category) && (filtered.some(product => product.category_id === item.id) || (!search.trim() && !buying)));
  return <section hidden={view === 'members'} aria-label="Inventario del hogar">
    <div className="inventory-sync"><p className="small">{!state.online ? 'Sin conexión · consulta los últimos datos cargados' : state.loading ? 'Actualizando el hogar…' : state.snapshot ? `Actualizado a las ${state.snapshot.updatedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : 'Conectando con el hogar…'}</p><button className="text-button" disabled={!state.online || state.loading || state.busy} onClick={() => void state.refresh()}>Actualizar</button></div>
    <p className="small inventory-hint" role="status">{!state.online ? 'Sin conexión. Conéctate a Internet para cambiar cantidades o agregar artículos.' : state.connection === 'live' ? 'Sincronización en vivo activa. Los cambios del hogar aparecen automáticamente.' : 'Reconectando sincronización. Comprobamos los cambios cada 30 segundos mientras la aplicación está visible.'}</p>
    {state.error && <p className="alert error" role="alert">{state.error}</p>}
    {state.pending && <div className="alert pending-operation" role="status"><p>{state.busy ? 'Confirmando la operación con el hogar…' : 'Hay una operación por confirmar. Reintentar conserva el mismo cambio.'}</p><button className="secondary" disabled={!state.online || state.busy || state.loading} onClick={() => { void state.retry().then(() => setForm(null)).catch(() => {}); }}>Reintentar operación</button></div>}
    {state.notice && <p className="success-message" role="status">{state.notice}</p>}
    {state.loading && !state.snapshot && <p className="card" role="status">Cargando categorías y productos…</p>}
    <div hidden={view !== 'products'}>
      <div className="inventory-summary"><div><strong>{products.length}</strong><span>productos en casa</span></div><div><strong>{products.filter(product => product.stock === 0).length}</strong><span>por comprar</span></div><div><strong>{categories.length}</strong><span>categorías</span></div></div>
      <div className="inventory-actions"><button className="primary" disabled={state.disabled || !categories.length} onClick={() => setForm('product')}>+ Agregar producto</button><button className="secondary" disabled={state.disabled} onClick={() => setForm('category')}>+ Categoría</button></div>
      {form && <InventoryForm key={form} kind={form} categories={categories} disabled={state.disabled} mutate={state.mutate} onClose={() => setForm(null)} />}
      {!categories.length && state.snapshot && <section className="card empty-state"><span aria-hidden="true">📦</span><h2>Empecemos a organizar la casa</h2><p>Crea una categoría, como Alimentos o Aseo, y agrega los artículos que quieres tener a mano.</p><button className="primary" disabled={state.disabled} onClick={() => setForm('category')}>Crear primera categoría</button></section>}
      {categories.length > 0 && <><div className="inventory-filters"><div><label htmlFor="inventory-search">Buscar en el hogar</label><input id="inventory-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Producto, marca o descripción" /></div><div><label htmlFor="inventory-category">Filtrar por categoría</label><select id="inventory-category" value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
        <div className="inventory-filter-row"><div className="filter-switch" aria-label="Disponibilidad"><button aria-pressed={!buying} onClick={() => setBuying(false)}>Todos</button><button aria-pressed={buying} onClick={() => setBuying(true)}>Por comprar</button></div><span className="small" role="status">{filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}</span></div>
        {groups.map(item => <section key={item.id} className="category-group" aria-labelledby={`category-${item.id}`}><h2 id={`category-${item.id}`}><span aria-hidden="true">{productIcons.find(icon => icon.id === item.icon_id)?.symbol || '📦'}</span> {item.name}</h2><div className="product-grid">{filtered.filter(product => product.category_id === item.id).map(product => <ProductCard key={product.id} product={product} disabled={state.disabled} mutate={state.mutate} showHistory={() => showHistory(product.id)} />)}</div>{!filtered.some(product => product.category_id === item.id) && <p className="empty-copy">Todavía no hay productos en esta categoría.</p>}</section>)}
        {!filtered.length && (search.trim() || buying) && <div className="card empty-state"><h2>{buying && !search.trim() ? 'Nada pendiente en esta selección' : 'No encontramos esos artículos'}</h2><p>{buying && !search.trim() ? 'Los productos con cantidad cero aparecerán aquí.' : 'Prueba otro nombre, marca o categoría.'}</p><button className="secondary" onClick={() => { setSearch(''); setCategory(''); setBuying(false); }}>Ver todos los productos</button></div>}
      </>}
    </div>
    <div hidden={view !== 'history'}><MovementHistory home={home} products={products} product={historyProduct} setProduct={setHistoryProduct} revision={state.revision} visible={view === 'history'} /></div>
  </section>;
}
