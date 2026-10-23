import { useCallback, useEffect, useRef, useState } from 'react';
import { applyMutation, getInventory, inventoryError, isDefiniteError, InventoryError } from '../lib/inventory-api';
import { isMutation, type Mutation } from '../lib/inventory-model';
import { supabase } from '../lib/supabase';
import { serialRefresh, watchInventory, type SyncStatus } from '../lib/inventory-sync';
import { inventoryLifecycle } from '../lib/inventory-lifecycle';

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
  const [connection, setConnection] = useState<SyncStatus>('connecting');
  const refreshRef = useRef<ReturnType<typeof serialRefresh> | null>(null);
  const store = (value: Mutation | null) => {
    pendingRef.current = value; setPending(value);
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); } catch { /* Mantener reintento en memoria. */ }
  };
  const refresh = useCallback(() => refreshRef.current?.run() || Promise.resolve(), []);
  useEffect(() => {
    let active = true, stopChannel: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const reader = serialRefresh(async () => {
      if (!navigator.onLine || !active) return;
      const sequence = ++request.current; setLoading(true);
      try {
        const data = await getInventory(home);
        if (active && navigator.onLine && sequence === request.current) { setSnapshot(data); setStale(false); setError(''); setRevision(value => value + 1); }
      } catch {
        if (active && sequence === request.current) { setStale(true); setError('No pudimos actualizar el inventario. Reintenta antes de cambiar cantidades.'); }
      } finally { if (active && sequence === request.current) setLoading(false); }
    });
    refreshRef.current = reader;
    const changed = () => {
      if (!active || timer) return;
      timer = setTimeout(() => { timer = undefined; void reader.run(); }, 100);
    };
    const connect = () => {
      clearTimeout(retryTimer); retryTimer = undefined;
      stopChannel?.(); stopChannel = undefined;
      if (!navigator.onLine) { setConnection('offline'); return; }
      setConnection('connecting');
      if (supabase) stopChannel = watchInventory(supabase, home, changed, value => {
        if (!active) return;
        setConnection(value);
        if (value === 'live') { clearTimeout(retryTimer); retryTimer = undefined; }
        else if (!retryTimer) retryTimer = setTimeout(() => { if (active && navigator.onLine) connect(); }, 5000);
      });
    };
    const reconnect = () => { setOnline(navigator.onLine); setStale(true); connect(); void reader.run(); };
    const disconnect = () => { ++request.current; clearTimeout(retryTimer); setLoading(false); setOnline(false); setStale(true); setConnection('offline'); stopChannel?.(); stopChannel = undefined; };
    connect(); void reader.run();
    // Red de seguridad si el socket parece conectado pero perdió notificaciones.
    const stopLifecycle = inventoryLifecycle({ reconnect, disconnect, poll: () => { void reader.run(); } });
    return () => {
      active = false; ++request.current; reader.stop(); refreshRef.current = null;
      clearTimeout(timer); clearTimeout(retryTimer); stopLifecycle(); stopChannel?.();
    };
  }, [home, userId]);
  async function execute(intent: Mutation, retry = false) {
    if (lock.current || (!retry && pendingRef.current)) throw new InventoryError('BUSY', 'Primero confirma la operación pendiente.');
    if (!navigator.onLine || (!retry && stale)) throw new InventoryError('OFFLINE', 'Actualiza el inventario cuando tengas conexión.');
    lock.current = true; setBusy(true); setNotice(''); setError(''); store(intent);
    try {
      await applyMutation(home, intent);
      store(null);
      setNotice(intent.type === 'remove-category' ? 'Categoría quitada. Los productos y sus cantidades se conservaron.' : intent.type === 'category' ? 'Categoría guardada.' : intent.type === 'product' ? 'Producto agregado al hogar.' : 'Cantidad guardada en el hogar.');
      await refresh();
    } catch (cause) {
      const failure = inventoryError(cause);
      if (isDefiniteError(failure)) { store(null); await refresh(); setError(failure.message); }
      else setError('La respuesta no llegó a tiempo. Reintenta la misma operación para confirmar su resultado.');
      throw failure;
    } finally { lock.current = false; setBusy(false); }
  }
  return { snapshot, loading, busy, pending, online, stale, error, notice, revision, refresh, connection,
    disabled: busy || Boolean(pending) || !online || stale || loading,
    mutate: (intent: Mutation) => execute(intent),
    retry: () => pendingRef.current ? execute(pendingRef.current, true) : Promise.resolve(),
  };
}
