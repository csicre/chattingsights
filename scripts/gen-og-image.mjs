// Genera public/og-image.png a partir de public/og-image.svg.
// Uso: node scripts/gen-og-image.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svgPath = resolve(root, 'public/og-image.svg');
const pngPath = resolve(root, 'public/og-image.png');

const svg = readFileSync(svgPath);

await sharp(svg, { density: 150 })
  .resize(1200, 630, { fit: 'fill' })
  .png()
  .toFile(pngPath);

console.log('OG image generated at', pngPath);
