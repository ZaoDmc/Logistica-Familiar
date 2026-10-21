import { useEffect, useId, useState, type FormEvent } from 'react';
import { productIcons } from '../../catalogs/icons';
import { parseStock, type Product, type Mutation } from '../../lib/inventory-model';

export function ProductCard({ product, disabled, mutate, showHistory }: {
  product: Product; disabled: boolean; mutate: (intent: Mutation) => Promise<void>; showHistory: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(product.stock)), [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(product.version), [error, setError] = useState('');
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
  const icon = productIcons.find(icon => icon.id === product.icon_id) || productIcons[productIcons.length - 1];
  return <article className="product-card" aria-labelledby={`${id}-title`}>
    <div className="product-heading"><span className="product-icon" aria-hidden="true">{icon.symbol}</span><div><h3 id={`${id}-title`}>{product.name}</h3>{product.description && <p>{product.description}</p>}</div></div>
    <div className="stock-heading"><span className={product.stock === 0 ? 'stock-status missing' : 'stock-status'}>{product.stock === 0 ? 'Por comprar' : 'Disponible'}</span><span className="small">Unidades en casa</span></div>
    <form onSubmit={save} className="stock-form">
      <div className="stock-control"><button type="button" className="quantity-button" aria-label={`Restar una unidad de ${product.name}`} disabled={disabled || dirty || product.stock === 0} onClick={() => void change('delta', -1)}>−</button>
        <label className="sr-only" htmlFor={`${id}-quantity`}>Cantidad de {product.name}</label><input id={`${id}-quantity`} type="number" inputMode="numeric" min={0} max={1000000} step={1} required value={draft} onChange={event => { if (!editing) setVersion(product.version); setEditing(true); setDraft(event.target.value); setError(''); }} disabled={disabled} />
        <button type="button" className="quantity-button" aria-label={`Sumar una unidad a ${product.name}`} disabled={disabled || dirty || product.stock === 1000000} onClick={() => void change('delta', 1)}>+</button></div>
      {dirty && <div className="quantity-confirm">{changed && <p className="small" role="status">La cantidad cambió. Ahora hay {product.stock} en casa; revisa el valor antes de guardar.</p>}<button className="primary compact" disabled={disabled || changed}>Guardar cantidad</button><button type="button" className="text-button" onClick={reset} disabled={disabled}>Usar cantidad actual</button></div>}
    </form>
    {error && <p className="alert error" role="alert">{error}</p>}
    <button className="text-button product-history" onClick={showHistory}>Ver movimientos<span className="sr-only"> de {product.name}</span></button>
  </article>;
}
