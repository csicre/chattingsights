import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Inyecta el meta tag de verificación de Google Search Console en el <head>
 * del index.html, pero SOLO si `VITE_GSC_VERIFICATION` está definida. Así el
 * HTML no queda con placeholders rotos cuando no se usa este método.
 *
 * Nota: para un dominio propio, la verificación recomendada es la propiedad de
 * Dominio por registro DNS TXT (ver docs/DEPLOYMENT.md). Este meta tag solo es
 * necesario si prefieres una propiedad de tipo "prefijo de URL".
 */
function searchConsoleVerification(token: string | undefined): Plugin {
  return {
    name: 'search-console-verification',
    transformIndexHtml(html) {
      if (!token) return html;
      const tag = `    <meta name="google-site-verification" content="${token}" />\n`;
      return html.replace('</head>', `${tag}  </head>`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  plugins: [react(), searchConsoleVerification(env.VITE_GSC_VERIFICATION)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  };
});
