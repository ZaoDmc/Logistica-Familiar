type Surface = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
type Environment = {
  window: Surface; document: Surface & { visibilityState: string };
  online: () => boolean; now: () => number;
  interval: (callback: () => void) => () => void;
};

// Inyección del entorno para verificar cortes y retorno sin depender del navegador de QA.
export function inventoryLifecycle(actions: { reconnect: () => void; disconnect: () => void; poll: () => void }, env: Environment = {
  window, document, online: () => navigator.onLine, now: Date.now,
  interval: callback => { const timer = setInterval(callback, 30000); return () => clearInterval(timer); },
}) {
  let lastResume = -Infinity;
  const resume = () => {
    if (env.document.visibilityState === 'visible' && env.now() - lastResume > 500) {
      lastResume = env.now(); actions.reconnect();
    }
  };
  const bindings: [Surface, string, () => void][] = [
    [env.window, 'online', actions.reconnect], [env.window, 'offline', actions.disconnect],
    [env.window, 'pageshow', resume], [env.window, 'focus', resume], [env.document, 'visibilitychange', resume],
  ];
  bindings.forEach(([surface, event, listener]) => surface.addEventListener(event, listener));
  const stopPolling = env.interval(() => { if (env.document.visibilityState === 'visible' && env.online()) actions.poll(); });
  return () => { stopPolling(); bindings.forEach(([surface, event, listener]) => surface.removeEventListener(event, listener)); };
}
