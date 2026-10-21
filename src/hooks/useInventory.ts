import { useCallback, useEffect, useRef, useState } from 'react';
import { applyMutation, getInventory, inventoryError, isDefiniteError, InventoryError } from '../lib/inventory-api';
import { isMutation, type Mutation } from '../lib/inventory-model';

export function useInventory(home: string, userId: string) {
  const storageKey = `lf.inventory.pending.${userId}.${home}`;
  const [pending, setPending] = useState<Mutation | null>(() => {
    try { const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); return isMutation(value) ? value : null; }
    catch { return null; }
  });
  const pendingRef = useRef(pending), lock = useRef(false), request = useRef(0);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof getInventory>> | null>(null);
  const [loading, setLoading] = useState(true), [stale, setStale] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [online, setOnline] = useState(navigator.onLine), [revision, setRevision] = useState(0);
  const store = (value: Mutation | null) => {
    pendingRef.current = value; setPending(value);
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); } catch { /* Mantener reintento en memoria. */ }
  };
  const refresh = useCallback(async () => {
    const sequence = ++request.current; setLoading(true);
    try {
      const data = await getInventory(home);
      if (sequence === request.current) { setSnapshot(data); setStale(false); setError(''); setRevision(value => value + 1); }
    } catch {
      if (sequence === request.current) { setStale(true); setError('No pudimos actualizar el inventario. Reintenta antes de cambiar cantidades.'); }
    } finally { if (sequence === request.current) setLoading(false); }
  }, [home]);
  useEffect(() => {
    void refresh();
    const reconnect = () => { setOnline(true); void refresh(); };
    const disconnect = () => { setOnline(false); setStale(true); };
    addEventListener('online', reconnect); addEventListener('offline', disconnect);
    return () => { ++request.current; removeEventListener('online', reconnect); removeEventListener('offline', disconnect); };
  }, [refresh]);
  async function execute(intent: Mutation, retry = false) {
    if (lock.current || (!retry && pendingRef.current)) throw new InventoryError('BUSY', 'Primero confirma la operación pendiente.');
    if (!navigator.onLine || (!retry && stale)) throw new InventoryError('OFFLINE', 'Actualiza el inventario cuando tengas conexión.');
    lock.current = true; setBusy(true); setNotice(''); setError(''); store(intent);
    try {
      await applyMutation(home, intent);
      store(null);
      setNotice(intent.type === 'category' ? 'Categoría guardada.' : intent.type === 'product' ? 'Producto agregado al hogar.' : 'Cantidad guardada en el hogar.');
      await refresh();
    } catch (cause) {
      const failure = inventoryError(cause);
      if (isDefiniteError(failure)) { store(null); await refresh(); setError(failure.message); }
      else setError('La respuesta no llegó a tiempo. Reintenta la misma operación para confirmar su resultado.');
      throw failure;
    } finally { lock.current = false; setBusy(false); }
  }
  return { snapshot, loading, busy, pending, online, stale, error, notice, revision, refresh,
    disabled: busy || Boolean(pending) || !online || stale || loading,
    mutate: (intent: Mutation) => execute(intent),
    retry: () => pendingRef.current ? execute(pendingRef.current, true) : Promise.resolve(),
  };
}
