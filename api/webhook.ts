/**
 * Vercel Serverless Function: webhook de Stripe.
 *
 * Verifica la firma del evento y registra los pagos completados. En esta app el
 * desbloqueo del informe se gestiona en el cliente (vuelta de Checkout con
 * ?paid=1), así que el webhook sirve sobre todo para auditoría y para ampliar en
 * el futuro (p. ej. generar licencias, enviar emails, etc.).
 *
 * IMPORTANTE: Stripe necesita el cuerpo RAW para verificar la firma, por eso
 * desactivamos el body parser de Vercel con `config.api.bodyParser = false`.
 *
 * Variables de entorno requeridas:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET  (whsec_...)
 */

import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on: (event: string, cb: (chunk?: Buffer) => void) => void;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  send: (body: string) => void;
}

/** Lee el cuerpo crudo de la petición (necesario para verificar la firma). */
function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      if (chunk) chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    res.status(500).json({ error: 'Webhook no configurado.' });
    return;
  }

  const stripe = new Stripe(secretKey);
  const signature = req.headers['stripe-signature'];

  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ error: 'Falta la cabecera stripe-signature.' });
    return;
  }

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    res.status(400).send(`Webhook signature verification failed: ${message}`);
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // Punto de extensión: registrar la venta, enviar email, emitir licencia…
      console.log(`Pago completado para la sesión ${session.id}`);
      break;
    }
    default:
      // Otros eventos: ignorados por ahora.
      break;
  }

  res.status(200).json({ received: true });
}
