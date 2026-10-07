# Guía de despliegue: GitHub + Vercel + Stripe

Esta guía cubre el despliegue de ChattingSights en producción con el dominio
`chattingsights.com`.

## 1. Subir el repositorio a GitHub

Desde la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Initial commit: ChattingSights"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/chattingsights.git
git push -u origin main
```

> El `.gitignore` ya excluye `node_modules`, `dist` y los archivos `.env`.
> **Nunca** subas claves secretas de Stripe al repositorio.

## 2. Crear el producto y el precio en Stripe

1. Entra en el [Dashboard de Stripe](https://dashboard.stripe.com/).
2. Empieza en **modo test** (interruptor arriba a la derecha).
3. Ve a **Productos → Añadir producto**.
4. Crea el producto "Informe ChattingSights" con un **precio único** (p. ej. 4,99 €).
5. Copia el **ID del precio** (`price_...`). Lo necesitarás como `STRIPE_PRICE_ID`.
6. En **Desarrolladores → Claves de API**, copia la **clave secreta** (`sk_test_...`).

## 3. Importar el proyecto en Vercel

1. Entra en [vercel.com](https://vercel.com/) con tu cuenta de GitHub.
2. **Add New → Project** e importa el repositorio.
3. Vercel detecta Vite automáticamente:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   (ya definidos en `vercel.json`).
4. No despliegues todavía: antes configura las variables de entorno.

## 4. Variables de entorno en Vercel

En **Project Settings → Environment Variables**, añade:

| Variable | Ejemplo | Entorno |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Production, Preview, Development |
| `STRIPE_PRICE_ID` | `price_...` | Production, Preview, Development |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production (ver paso 6) |
| `PUBLIC_SITE_URL` | `https://chattingsights.com` | Production |
| `VITE_REPORT_PRICE_CENTS` | `499` | Production, Preview, Development |
| `VITE_REPORT_CURRENCY` | `eur` | Production, Preview, Development |
| `VITE_GA_ID` | `G-XXXXXXXXXX` | Production (Preview si quieres medir) |
| `VITE_GSC_VERIFICATION` | *(solo si verificas por meta tag)* | Production |

> Las variables con prefijo `VITE_` se incrustan en el bundle del cliente (solo
> datos no sensibles). Las demás son solo de servidor.

Despliega el proyecto.

## 5. Conectar el dominio chattingsights.com

1. En **Project Settings → Domains**, añade `chattingsights.com` y `www.chattingsights.com`.
2. Vercel te indicará los registros DNS. En tu registrador del dominio:
   - Apunta el registro `A` de `@` a la IP que indique Vercel, **o**
   - usa los nameservers de Vercel (opción recomendada por Vercel).
3. Espera a la propagación DNS y a que Vercel emita el certificado SSL.

## 6. Configurar el webhook de Stripe

1. En Stripe: **Desarrolladores → Webhooks → Añadir endpoint**.
2. URL del endpoint: `https://chattingsights.com/api/webhook`.
3. Eventos a escuchar: `checkout.session.completed`.
4. Copia el **signing secret** (`whsec_...`) y guárdalo como
   `STRIPE_WEBHOOK_SECRET` en Vercel. Vuelve a desplegar para que tome la variable.

## 7. Probar el pago end-to-end (modo test)

1. Abre `https://chattingsights.com`, sube un chat y pulsa desbloquear.
2. Usa una [tarjeta de prueba de Stripe](https://stripe.com/docs/testing),
   p. ej. `4242 4242 4242 4242`, fecha futura y CVC cualquiera.
3. Al completar, Stripe redirige a `/?paid=1` y el informe se desbloquea.

## 8. Pasar a producción

1. En Stripe, cambia a **modo live** y repite la creación de producto/precio y
   webhook con las claves `sk_live_...` / `whsec_...` live.
2. Actualiza las variables de entorno de producción en Vercel con las claves live.
3. Vuelve a desplegar.

---

## Notas de seguridad

- La clave secreta de Stripe solo vive en variables de entorno del servidor
  (Vercel Functions), nunca en el cliente.
- El webhook verifica la firma con `STRIPE_WEBHOOK_SECRET`; sin firma válida, se
  rechaza la petición.
- El informe y la conversación nunca salen del navegador del usuario.

## 9. Google Analytics 4

El sitio usa GA4 (gtag.js) con consentimiento previo y Consent Mode v2.

1. En [Google Analytics](https://analytics.google.com/), crea una propiedad GA4
   y un flujo de datos **Web** para `https://chattingsights.com`.
2. Copia el **ID de medición** (`G-XXXXXXXXXX`).
3. Guárdalo como `VITE_GA_ID` en Vercel (Production; también Preview si quieres
   medir los despliegues de prueba). Vuelve a desplegar.

Cómo se comporta:

- No se carga ningún script hasta que el usuario **acepta** el banner de
  consentimiento. Si lo rechaza, GA no se carga; la decisión se recuerda en
  `localStorage`.
- La app React registra **vistas de página virtuales** (SPA) y eventos del
  funnel: `view_example`, `start_upload`, `upload_chat`, `analysis_success`,
  `analysis_error`, y del embudo de pago `begin_checkout`, `purchase` (con
  `value`/`currency`) y `checkout_cancelled`.
- Las **guías estáticas** (`/guia/*.html`) comparten el mismo ID y el mismo
  consentimiento (misma clave de `localStorage`). El ID se inyecta en el build
  con `scripts/inject-ga.mjs` reemplazando el placeholder `__GA_ID__` en
  `dist/guia/analytics.js`. Sin `VITE_GA_ID`, el placeholder queda intacto y no
  se carga nada.

> Marca `purchase` (y opcionalmente `begin_checkout`) como **conversión** en
> GA4 → Administrar → Eventos para medir el embudo de pago.

## 10. Google Search Console

Verifica la propiedad para enviar el sitemap y seguir el rendimiento en búsqueda.

**Opción recomendada — propiedad de Dominio (DNS TXT).** Cubre `www`/sin-`www`
y http/https de una vez, y es la más duradera.

1. En [Search Console](https://search.google.com/search-console) → **Añadir
   propiedad → Dominio**, escribe `chattingsights.com`.
2. Copia el registro **TXT** que te da Google.
3. Añádelo en el DNS del dominio (si el DNS está en Vercel: **Project Settings →
   Domains → el dominio → DNS Records → Add**, tipo `TXT`, nombre `@`).
4. Espera la propagación y pulsa **Verificar**.

**Opción alternativa — propiedad de prefijo de URL (meta tag).** Útil si solo
quieres medir `https://chattingsights.com/`.

1. En Search Console → **Añadir propiedad → Prefijo de URL**, elige el método
   **Etiqueta HTML** y copia el valor del atributo `content`.
2. Guárdalo como `VITE_GSC_VERIFICATION` en Vercel y vuelve a desplegar. El
   plugin de Vite inyecta el `<meta name="google-site-verification">` en el
   `<head>` solo cuando esta variable está definida.

**Enviar el sitemap (ambas opciones).** En Search Console → **Sitemaps**, añade
`https://chattingsights.com/sitemap.xml`. El `robots.txt` ya lo referencia.

## Limitación del modelo de gating

Como el análisis es 100% cliente, el "desbloqueo" se guarda en `localStorage`
tras volver del pago. Es suficiente para un SaaS pequeño, pero un usuario técnico
podría manipularlo. Si en el futuro necesitas un gating más fuerte, las opciones
son: mover el análisis premium a una Function de servidor, o firmar un token de
desbloqueo en el webhook y validarlo. El punto de extensión está en `api/webhook.ts`.
