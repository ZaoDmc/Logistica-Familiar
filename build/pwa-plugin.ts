import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadEnv, type Plugin } from 'vite';

export function householdPwa(): Plugin {
  return {
    name: 'household-pwa', apply: 'build', enforce: 'post',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, 'VITE_');
      const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let anon = false;
      try { anon = JSON.parse(Buffer.from(key?.split('.')[1] || '', 'base64url').toString()).role === 'anon'; } catch { /* Las claves publishable no son JWT. */ }
      if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !key || !(key.startsWith('sb_publishable_') || anon)) {
        throw new Error('El build necesita la URL HTTPS de Supabase y una clave pública publishable o anon. No usar claves administrativas.');
      }
    },
    generateBundle(_options, bundle) {
      const publicFiles = ['offline.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
      const assets = Object.keys(bundle).filter(path => /^assets\/.+\.(js|css)$/.test(path));
      const version = createHash('sha256');
      for (const path of Object.keys(bundle).sort()) {
        const item = bundle[path]; version.update(path); version.update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const path of publicFiles) version.update(readFileSync(new URL(`../public/${path}`, import.meta.url)));
      const worker = readFileSync(new URL('../src/pwa/worker.js', import.meta.url), 'utf8');
      version.update(worker);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source:
        `const BUILD_ID = ${JSON.stringify(version.digest('hex').slice(0, 16))};\nconst STATIC_FILES = ${JSON.stringify([...assets, ...publicFiles].map(path => `/${path}`))};\n${worker}` });
    },
  };
}
