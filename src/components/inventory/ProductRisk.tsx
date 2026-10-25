import { useId, useState, type FormEvent } from 'react';
import { parseStock, type Mutation, type Product } from '../../lib/inventory-model';

export function ProductRisk({ product, disabled, mutate }: { product: Product; disabled: boolean; mutate: (intent: Mutation) => Promise<void> }) {
  const id = useId();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState('');
  const [version, setVersion] = useState(product.risk_version), [error, setError] = useState('');
  const conflict = String(version) !== String(product.risk_version);
  function reset() { setDraft(String(product.risk_quantity)); setVersion(product.risk_version); setError(''); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (disabled || conflict) return;
    const quantity = parseStock(draft);
    if (quantity === null) { setError('Usa un entero entre 0 y 1.000.000.'); return; }
    setError('');
    try { await mutate({ type: 'risk', product_id: product.id, quantity, version }); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos guardar el límite.'); }
  }
  return <div className="product-risk">
    <p className="small">Cantidad en riesgo: <strong>{product.risk_quantity}</strong></p>
    <button type="button" className="text-button" disabled={disabled} aria-expanded={open} aria-controls={id} aria-label={`Editar cantidad en riesgo de ${product.name}`} onClick={() => { reset(); setOpen(!open); }}>Editar cantidad en riesgo</button>
    {open && <form id={id} className="form-stack risk-form" onSubmit={event => void save(event)}>
      <label htmlFor={`${id}-value`}>Cantidad en riesgo de {product.name}</label><input id={`${id}-value`} type="number" inputMode="numeric" min={0} max={1000000} step={1} required value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} />
      <p className="small">Con stock positivo igual o menor al límite: Por agotarse. Con cero: Por comprar.</p>
      {conflict && <p className="alert" role="status">Otra persona cambió el límite a {product.risk_quantity}. Revisa el valor antes de guardar.</p>}
      {error && <p className="alert error" role="alert">{error}</p>}
      <button className="primary" disabled={disabled || conflict}>Guardar cantidad en riesgo</button>
      {conflict && <button type="button" className="secondary" disabled={disabled} onClick={reset}>Usar límite actual</button>}
      <button type="button" className="text-button" disabled={disabled} onClick={() => setOpen(false)}>Cancelar</button>
    </form>}
  </div>;
}
