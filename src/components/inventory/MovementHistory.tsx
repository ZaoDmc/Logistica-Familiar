import { useEffect, useRef, useState } from 'react';
import { getMovements } from '../../lib/inventory-api';
import type { Movement, Product } from '../../lib/inventory-model';

export function MovementHistory({ home, products, product, setProduct, revision, visible }: {
  home: string; products: Product[]; product: string; setProduct: (value: string) => void; revision: number; visible: boolean;
}) {
  const [rows, setRows] = useState<Movement[]>([]), [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const sequence = useRef(0), lock = useRef(false);
  useEffect(() => {
    if (!visible) return;
    const current = ++sequence.current; setLoading(true); setError(''); setRows([]); setMore(false);
    void getMovements(home, product).then(data => { if (current === sequence.current) { setRows(data.rows); setMore(data.more); } })
      .catch(() => { if (current === sequence.current) setError('No pudimos cargar los movimientos. Actualiza para reintentar.'); })
      .finally(() => { if (current === sequence.current) setLoading(false); });
    return () => { ++sequence.current; };
  }, [home, product, revision, visible]);
  async function next() {
    if (lock.current || !rows.length) return;
    lock.current = true; const current = sequence.current; setLoading(true); setError('');
    try {
      const data = await getMovements(home, product, rows[rows.length - 1]);
      if (current === sequence.current) { setRows(previous => [...previous, ...data.rows]); setMore(data.more); }
    } catch { if (current === sequence.current) setError('No pudimos cargar más movimientos. Intenta nuevamente.'); }
    finally { lock.current = false; if (current === sequence.current) setLoading(false); }
  }
  return <section className="card history-section" aria-labelledby="history-title">
    <h2 id="history-title">Lo que cambió en casa</h2><p className="small">Cada cantidad confirmada conserva quién la cambió y cuándo.</p>
    <label htmlFor="history-product">Movimientos de</label><select id="history-product" value={product} onChange={event => setProduct(event.target.value)}><option value="">Todo el hogar</option>{[...products].sort((a, b) => a.name.localeCompare(b.name, 'es')).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    {error && <p className="alert error" role="alert">{error}</p>}
    {!loading && !rows.length && !error && <p className="empty-copy">Todavía no hay movimientos para esta selección.</p>}
    <ol className="movement-list">{rows.map(row => <li key={row.id}>
      <div className="movement-line"><strong>{row.product_name}</strong><span className="movement-amount">{row.previous_stock} <span aria-hidden="true">→</span><span className="sr-only"> a </span> {row.new_stock}</span></div>
      <p className="small">{row.kind === 'initial' ? 'Stock inicial' : row.kind === 'set' ? 'Cantidad ajustada' : row.delta > 0 ? `Se agregó ${row.delta}` : `Se retiró ${Math.abs(row.delta)}`} · {row.actor_name}</p>
      <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</time>
    </li>)}</ol>
    {loading && <p role="status">Cargando movimientos…</p>}{more && <button className="secondary" disabled={loading} onClick={() => void next()}>Cargar más movimientos</button>}
  </section>;
}
