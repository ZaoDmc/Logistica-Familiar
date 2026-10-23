import type { SupabaseClient } from '@supabase/supabase-js';

export type SyncStatus = 'connecting' | 'live' | 'recovering' | 'offline';

// Una lectura en curso nunca descarta una invalidación que llega después.
export function serialRefresh(read: () => Promise<void>) {
  let running: Promise<void> | null = null, queued = false, stopped = false;
  return {
    run(): Promise<void> {
      if (stopped) return Promise.resolve();
      queued = true;
      if (!running) running = (async () => {
        try { while (queued && !stopped) { queued = false; await read(); } }
        finally { running = null; }
      })();
      return running;
    },
    stop() { stopped = true; queued = false; },
  };
}

export function watchInventory(client: SupabaseClient, home: string, changed: () => void, status: (value: SyncStatus) => void) {
  let stopped = false;
  const channel = client.channel(`inventory:${home}:${crypto.randomUUID()}`);
  for (const table of ['products', 'categories', 'stock_movements']) {
    const events = table === 'products' ? ['INSERT', 'UPDATE'] as const : ['INSERT'] as const;
    for (const event of events) channel.on('postgres_changes', { event, schema: 'public', table, filter: `household_id=eq.${home}` }, () => { if (!stopped) changed(); });
  }
  // Realtime no permite filtrar DELETE por hogar. Solo invalida la lectura;
  // la consulta posterior sigue limitada por hogar y RLS, sin usar el payload.
  channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'categories' }, () => { if (!stopped) changed(); });
  channel.on('system', {}, event => {
    if (!stopped && event.status === 'error') { status('recovering'); changed(); }
  });
  channel.subscribe(value => {
    if (stopped) return;
    status(value === 'SUBSCRIBED' ? 'live' : 'recovering');
    // Reconsulta al suscribirse: los eventos perdidos no se reproducen.
    if (value === 'SUBSCRIBED') changed();
  });
  return () => { stopped = true; void client.removeChannel(channel); };
}
