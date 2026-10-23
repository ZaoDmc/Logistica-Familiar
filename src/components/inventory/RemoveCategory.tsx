import { useId, useState } from 'react';
import type { Category, Mutation } from '../../lib/inventory-model';

export function RemoveCategory({ category, categories, count, disabled, mutate, onClose }: {
  category: Category; categories: Category[]; count: number; disabled: boolean;
  mutate: (intent: Mutation) => Promise<void>; onClose: () => void;
}) {
  const id = useId(), destinations = categories.filter(item => item.id !== category.id);
  const [destination, setDestination] = useState(''), [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (disabled) return;
    if (count > 0 && !destinations.some(item => item.id === destination)) { setError('Elige dónde conservar los productos.'); return; }
    try { await mutate({ type: 'remove-category', category_id: category.id, destination_id: destination || null }); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos quitar la categoría.'); }
  }
  return <form className="card remove-category" onSubmit={event => void submit(event)} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>¿Quitar «{category.name}»?</h2>
    {count > 0 ? <>
      <p>Hay {count} {count === 1 ? 'producto' : 'productos'} aquí. Elige otra categoría para conservarlos con sus cantidades e historial.</p>
      {destinations.length ? <><label htmlFor={`${id}-destination`}>Mover los productos a</label><select id={`${id}-destination`} value={destination} onChange={event => setDestination(event.target.value)} required disabled={disabled}><option value="">Elige una categoría</option>{destinations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></> : <p className="alert">Crea otra categoría antes de quitar esta, para que sus productos tengan dónde quedar.</p>}
    </> : <p>Esta categoría está vacía. Al confirmar se quitará del hogar para todos.</p>}
    {error && <p className="alert error" role="alert">{error}</p>}
    <div className="button-row"><button type="button" className="secondary" disabled={disabled} onClick={onClose}>Cancelar</button><button className="primary" disabled={disabled || (count > 0 && !destinations.some(item => item.id === destination))}>{disabled ? 'Confirmando…' : count ? 'Mover productos y quitar categoría' : 'Quitar categoría'}</button></div>
  </form>;
}
