import { useEffect, useState } from 'react';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaControls() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null), [standalone, setStandalone] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [update, setUpdate] = useState(false), [installing, setInstalling] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    const display = matchMedia('(display-mode: standalone)');
    const installed = () => { setStandalone(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)); setPrompt(null); };
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    installed(); display.addEventListener('change', installed);
    addEventListener('beforeinstallprompt', offer); addEventListener('appinstalled', installed);
    return () => { display.removeEventListener('change', installed); removeEventListener('beforeinstallprompt', offer); removeEventListener('appinstalled', installed); };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !isSecureContext) return;
    let active = true, reg: ServiceWorkerRegistration | undefined, worker: ServiceWorker | null = null;
    let lastCheck = 0, controlled = Boolean(navigator.serviceWorker.controller);
    const ready = () => { if (active && reg?.active && reg.waiting) setUpdate(true); };
    const found = () => { worker?.removeEventListener('statechange', ready); worker = reg?.installing || null; worker?.addEventListener('statechange', ready); ready(); };
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastCheck > 30000) { lastCheck = Date.now(); void reg?.update().catch(() => {}); }
    };
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(value => {
      if (!active) return;
      reg = value; setRegistration(value); value.addEventListener('updatefound', found); ready(); found(); check();
    }).catch(() => { /* El acceso web sigue disponible aunque el navegador no admita la instalación. */ });
    const changed = () => { if (active && controlled) setUpdate(true); controlled = true; };
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    document.addEventListener('visibilitychange', check); addEventListener('online', check);
    return () => {
      active = false; reg?.removeEventListener('updatefound', found); worker?.removeEventListener('statechange', ready);
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      document.removeEventListener('visibilitychange', check); removeEventListener('online', check);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    setInstalling(true); setMessage('');
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { setMessage('Puedes instalarla desde el menú de tu navegador.'); }
    finally { setPrompt(null); setInstalling(false); }
  }
  function reload() {
    // Esperar al nuevo controlador únicamente cuando la persona solicita recargar.
    if (registration?.waiting) {
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    } else location.reload();
  }
  return <aside className="pwa-controls" aria-label="Aplicación en tu celular">
    {update && <div className="alert" role="status"><strong>Hay una versión nueva.</strong><p>Guarda tus cambios y confirma las operaciones pendientes antes de recargar.</p><button className="secondary" onClick={reload}>Recargar aplicación</button></div>}
    {!standalone && <details><summary>Instalar en el celular</summary><p>Abre tu hogar desde un icono, como una aplicación.</p>{prompt && <button className="primary" disabled={installing} onClick={() => void install()}>{installing ? 'Abriendo instalación…' : 'Instalar Mi hogar'}</button>}<p className="small"><strong>Android:</strong> menú del navegador → Instalar aplicación o Agregar a pantalla de inicio.<br /><strong>iPhone:</strong> abre en Safari → Compartir → Añadir a pantalla de inicio.</p><p className="small">Necesitas Internet para consultar y cambiar el inventario.</p>{message && <p role="status">{message}</p>}</details>}
  </aside>;
}
