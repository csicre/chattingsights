/**
 * Vercel Serverless Function: crea una sesión de Stripe Checkout (pago único).
 *
 * La clave secreta de Stripe vive SOLO aquí (variable de entorno del servidor),
 * nunca en el cliente. El cliente llama a esta ruta y recibe la URL de Checkout.
 *
 * Variables de entorno requeridas en Vercel:
 *   STRIPE_SECRET_KEY   - clave secreta (sk_live_... / sk_test_...)
 *   STRIPE_PRICE_ID     - id del precio del producto (price_...)
 *   PUBLIC_SITE_URL     - URL pública del sitio, sin barra final
 */

import Stripe from 'stripe';

interface VercelRequest {
  method?: string;
  body: unknown;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const siteUrl = process.env.PUBLIC_SITE_URL;

  if (!secretKey || !priceId || !siteUrl) {
    res.status(500).json({
      error:
        'Stripe no está configurado. Faltan STRIPE_SECRET_KEY, STRIPE_PRICE_ID o PUBLIC_SITE_URL.',
    });
    return;
  }

  const stripe = new Stripe(secretKey);

  // Locale opcional enviado por el cliente para la UI de Checkout.
  let locale: Stripe.Checkout.SessionCreateParams.Locale = 'auto';
  const body = req.body as { locale?: string } | undefined;
  if (body?.locale === 'es' || body?.locale === 'en') {
    locale = body.locale;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?cancelled=1`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}
