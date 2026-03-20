// ═══════════════════════════════════════════════════════════
// SmartCrick AI — Stripe Checkout Session
// ═══════════════════════════════════════════════════════════

const PRICE_IDS = {
  monthly:  'price_1SugNn6MhuIR6zbAZMSb1Vrc',
  yearly:   'price_1SugSq6MhuIR6zbAw991j7Ur',
  lifetime: 'price_1SugW66MhuIR6zbAEq9yThmh',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { planType, successUrl, cancelUrl } = req.body || {};

  const priceId = PRICE_IDS[planType];
  if (!priceId) return res.status(400).json({ error: `Invalid plan: ${planType}` });

  const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const isLifetime = planType === 'lifetime';

    const body = new URLSearchParams({
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: isLifetime ? 'payment' : 'subscription',
      success_url: successUrl || 'https://smartcricai.base44.app?payment=success',
      cancel_url:  cancelUrl  || 'https://smartcricai.base44.app?payment=cancelled',
      'metadata[plan]': planType,
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const session = await response.json();
    if (!response.ok) throw new Error(session.error?.message || 'Stripe error');

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
