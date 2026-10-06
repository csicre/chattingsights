# ChattingSights

Analiza exports de conversaciones de WhatsApp directamente en el navegador y
obtén insights: frecuencia de mensajes, tiempos de respuesta, emojis, mapa de
palabras, análisis de emociones y un perfil de personalidad heurístico.

**Privacidad primero:** todo el procesamiento ocurre en el cliente. Las
conversaciones nunca se suben a ningún servidor.

- **Frontend:** React 18 + TypeScript + Vite
- **Visualizaciones:** D3
- **i18n:** español e inglés (preparado para más idiomas)
- **Pagos:** Stripe Checkout (pago único) vía Vercel Serverless Functions
- **Exportación:** PDF e imagen (html-to-image + jsPDF)

---

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev
```

La app corre en `http://localhost:5173`.

> En desarrollo, si Stripe no está configurado, el botón de desbloqueo del
> informe desbloquea localmente para que puedas probar la UI completa.

### Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Compila TypeScript y genera el build de producción |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run test` | Ejecuta los tests (Vitest) |
| `npm run lint` | Linter (ESLint) |
| `npm run typecheck` | Comprobación de tipos sin emitir |

---

## Arquitectura

```
src/
  core/          Lógica pura, testeable y sin dependencias de React
    types.ts       Tipos de dominio compartidos
    parser.ts      Parser de exports de WhatsApp (multi-formato ES/EN, iOS/Android)
    analyzer.ts    Motor de análisis algorítmico (sin IA)
    lexicons.ts    Stopwords y léxicos de sentimiento por idioma
    text.ts        Tokenización y extracción de emojis (Unicode)
    format.ts      Formato de fechas, números y precios por locale
  components/    Componentes React (UI y gráficos D3)
    charts/        BarChart, WordCloud, RadarChart
  services/      Checkout (Stripe) y exportación (PDF/imagen)
  state/         Estado global (React Context)
  i18n/          Configuración y recursos de traducción
api/             Vercel Serverless Functions (Stripe)
```

### ¿Por qué el procesamiento es en cliente?

El export de WhatsApp contiene datos personales de terceros que no han dado su
consentimiento. Procesarlo solo en el navegador evita responsabilidades de
tratamiento de datos (RGPD) y es un argumento de confianza para el usuario.

### Añadir un idioma nuevo

1. Crea `src/i18n/locales/<código>.ts` siguiendo el `TranslationSchema` de `es.ts`.
2. Regístralo en `src/i18n/index.ts` (`resources` y `SUPPORTED_UI_LANGUAGES`).
3. Añade su léxico en `src/core/lexicons.ts` (`LEXICONS`) y, si procede, amplía
   `SupportedLanguage` en `src/core/types.ts` y la detección en `parser.ts`.

---

## Despliegue en Vercel

Consulta la guía detallada en [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Resumen:

1. Sube el repo a GitHub.
2. Importa el proyecto en Vercel (detecta Vite automáticamente).
3. Configura las variables de entorno de Stripe.
4. Crea el producto/precio en Stripe y el webhook apuntando a `/api/webhook`.

---

## Aviso

El "análisis de personalidad" es un conjunto de indicadores lúdicos derivados de
métricas de comportamiento (quién inicia, rapidez de respuesta, uso de emojis…).
No es una evaluación psicológica.
