/**
 * Cliente del flujo de pago.
 *
 * Llama a la Vercel Function /api/create-checkout-session, que crea una sesión
 * de Stripe Checkout en el servidor (la clave secreta nunca toca el navegador)
 * y devuelve la URL a la que redirigir.
 */

export interface CheckoutResponse {
  url: string;
}

/**
 * Inicia el checkout. Al volver, Stripe redirige a /?paid=1 (success) para que
 * la app marque el informe como desbloqueado.
 */
export async function startCheckout(locale: string): Promise<void> {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Checkout failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as CheckoutResponse;
  if (!data.url) throw new Error('Checkout session has no URL');

  // Redirección a Stripe Checkout (dominio seguro de Stripe).
  window.location.assign(data.url);
}

/**
 * Lee el parámetro de retorno de Stripe en la URL.
 * Devuelve 'paid' si el pago fue correcto, 'cancelled' si se canceló, o null.
 */
export function readCheckoutReturn(): 'paid' | 'cancelled' | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('paid') === '1') return 'paid';
  if (params.get('cancelled') === '1') return 'cancelled';
  return null;
}

/** Limpia los parámetros de query de la URL sin recargar. */
export function clearCheckoutParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('paid');
  url.searchParams.delete('cancelled');
  url.searchParams.delete('session_id');
  window.history.replaceState({}, '', url.toString());
}
