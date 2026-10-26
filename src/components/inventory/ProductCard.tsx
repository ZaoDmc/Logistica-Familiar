import { useEffect, useId, useState, type FormEvent } from 'react';
import { productIcons } from '../../catalogs/icons';
import { minimumToBuy, parseStock, stockStatus, type Product, type Mutation } from '../../lib/inventory-model';
import { ProductRisk } from './ProductRisk';

export function ProductCard({ product, disabled, mutate, showHistory, allowDelete = false, showPurchaseQuantity = false }: {
  product: Product; disabled: boolean; mutate: (intent: Mutation) => Promise<void>; showHistory: () => void;
  allowDelete?: boolean; showPurchaseQuantity?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(product.stock)), [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(product.version), [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const blocked = disabled || removing;
  const dirty = editing && draft !== String(product.stock);
  const changed = dirty && String(version) !== String(product.version);
  useEffect(() => {
    if (!editing || draft === String(product.stock)) { setDraft(String(product.stock)); setVersion(product.version); setEditing(false); setError(''); }
  }, [product.stock, product.version, editing, draft]);
  async function change(kind: 'delta' | 'set', quantity: number) {
    if (disabled) return;
    setError('');
    try {
      await mutate({ type: 'stock', product_id: product.id, operation_id: crypto.randomUUID(), kind, quantity, version: kind === 'set' ? version : null });
      setEditing(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'No pudimos guardar la cantidad.'); }
  }
  function save(event: FormEvent) {
    event.preventDefault(); const quantity = parseStock(draft);
    if (quantity === null) { setError('Usa una cantidad entera entre 0 y 1.000.000.'); return; }
    void change('set', quantity);
  }
  function reset() { setDraft(String(product.stock)); setVersion(product.version); setEditing(false); setError(''); }
  async function remove() {
    if (disabled || dirty) return;
    setError('');
    try { await mutate({ type: 'remove-product', product_id: product.id }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos eliminar el producto.'); }
  }
  const icon = productIcons.find(icon => icon.id === product.icon_id) || productIcons[productIcons.length - 1];
  const status = stockStatus(product);
  return <article className="product-card" aria-labelledby={`${id}-title`}>
    <div className="product-heading"><span className="product-icon" aria-hidden="true">{icon.symbol}</span><div><h3 id={`${id}-title`}>{product.name}</h3>{showPurchaseQuantity && <p className="purchase-quantity">Hay que comprar: <strong>{minimumToBuy(product)}</strong></p>}{product.description && <p>{product.description}</p>}</div></div>
    {showPurchaseQuantity && product.risk_quantity === 1000000 && <p className="small">El límite está en el máximo que admite la app. Reduce la cantidad en riesgo para poder registrarlo como Disponible.</p>}
    <div className="stock-heading"><span className={`stock-status ${status}`}>{status === 'missing' ? 'Por comprar' : status === 'warning' ? 'Por agotarse' : 'Disponible'}</span><span className="small">Unidades en casa</span></div>
    <form onSubmit={save} className="stock-form">
      <div className="stock-control"><button type="button" className="quantity-button" aria-label={`Restar una unidad de ${product.name}`} disabled={blocked || dirty || product.stock === 0} onClick={() => void change('delta', -1)}>−</button>
        <label className="sr-only" htmlFor={`${id}-quantity`}>Cantidad de {product.name}</label><input id={`${id}-quantity`} type="number" inputMode="numeric" min={0} max={1000000} step={1} required value={draft} onChange={event => { if (!editing) setVersion(product.version); setEditing(true); setDraft(event.target.value); setError(''); }} disabled={blocked} />
        <button type="button" className="quantity-button" aria-label={`Sumar una unidad a ${product.name}`} disabled={blocked || dirty || product.stock === 1000000} onClick={() => void change('delta', 1)}>+</button></div>
      {dirty && <div className="quantity-confirm">{changed && <p className="small" role="status">La cantidad cambió. Ahora hay {product.stock} en casa; revisa el valor antes de guardar.</p>}<button className="primary compact" disabled={disabled || changed}>Guardar cantidad</button><button type="button" className="text-button" onClick={reset} disabled={disabled}>Usar cantidad actual</button></div>}
    </form>
    {error && <p className="alert error" role="alert">{error}</p>}
    <ProductRisk product={product} disabled={blocked || dirty} mutate={mutate} />
    <button className="text-button product-history" onClick={showHistory}>Ver movimientos<span className="sr-only"> de {product.name}</span></button>
    {allowDelete && <>
      <button type="button" className="text-button danger product-delete" aria-label={`Eliminar producto ${product.name}`} aria-expanded={removing} disabled={disabled || dirty || removing} onClick={() => { setError(''); setRemoving(true); }}>Eliminar producto</button>
      {removing && <section className="product-remove-confirm" aria-labelledby={`${id}-remove-title`}>
        <h4 id={`${id}-remove-title`}>¿Eliminar «{product.name}»?</h4>
        <p>Dejará de aparecer en Productos y Reposición para todos los integrantes. Su historial de movimientos se conserva.</p>
        <div className="button-row"><button autoFocus type="button" className="secondary" disabled={disabled} onClick={() => setRemoving(false)}>Cancelar</button><button type="button" className="danger-button" disabled={disabled} onClick={() => void remove()}>{disabled ? 'Confirmando…' : 'Confirmar eliminación'}</button></div>
      </section>}
    </>}
  </article>;
}
