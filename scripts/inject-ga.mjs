/**
 * Inyecta el ID de Google Analytics en los assets estáticos de las guías.
 *
 * Las guías HTML (public/guia/*.html) se sirven directamente sin pasar por el
 * bundle de React, así que no tienen acceso a `import.meta.env.VITE_GA_ID`.
 * Este script, que corre DESPUÉS de `vite build`, sustituye el placeholder
 * `__GA_ID__` en `dist/guia/analytics.js` por el valor real de la variable de
 * entorno `VITE_GA_ID`.
 *
 * Si `VITE_GA_ID` no está definido, deja el placeholder intacto: analytics.js
 * detecta ese caso y no carga nada (ver public/guia/analytics.js).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const target = resolve(root, 'dist/guia/analytics.js');

/**
 * Resuelve VITE_GA_ID. En Vercel/CI viene como variable de entorno real; en
 * local suele estar en `.env.local`. Priorizamos process.env y, si no está,
 * hacemos una lectura mínima de .env.local (sin dependencias externas).
 */
async function resolveGaId() {
  if (process.env.VITE_GA_ID?.trim()) return process.env.VITE_GA_ID.trim();
  const envFile = resolve(root, '.env.local');
  if (!existsSync(envFile)) return undefined;
  const content = await readFile(envFile, 'utf8');
  const match = content.match(/^\s*VITE_GA_ID\s*=\s*(.+?)\s*$/m);
  return match?.[1]?.replace(/^["']|["']$/g, '').trim() || undefined;
}

const gaId = await resolveGaId();

if (!gaId) {
  console.log('[inject-ga] VITE_GA_ID no definido: se omite la inyección en guías.');
  process.exit(0);
}

if (!existsSync(target)) {
  console.warn(`[inject-ga] No se encontró ${target}; nada que inyectar.`);
  process.exit(0);
}

const original = await readFile(target, 'utf8');
const replaced = original.replaceAll('__GA_ID__', gaId);

if (replaced === original) {
  console.log('[inject-ga] No se encontró el placeholder __GA_ID__ (¿ya inyectado?).');
} else {
  await writeFile(target, replaced, 'utf8');
  console.log(`[inject-ga] GA ID inyectado en dist/guia/analytics.js (${gaId}).`);
}
