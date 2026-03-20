// ═══════════════════════════════════════════════════════════
// SmartCrick AI — OTP Email Handler (Brevo)
// Free plan: 300 emails/day = 9,000/month
// ═══════════════════════════════════════════════════════════

// In-memory OTP store with 5-minute expiry
// NOTE: This resets on cold starts (Vercel serverless).
// For production scale, swap with Upstash Redis (free tier).
const otpStore = new Map();

// Clean up expired OTPs every request to avoid memory leaks
function cleanExpired() {
  const now = Date.now();
  for (const [key, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(key);
    }
  }
}

export default async function handler(req, res) {
  // ── CORS headers ───────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Validate inputs ────────────────────────────────────
  const { email, otp } = req.body || {};

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  if (!/^\d{6}$/.test(String(otp))) {
    return res.status(400).json({ error: 'OTP must be 6 digits' });
  }

  // ── Rate limit: max 3 OTPs per email per 5 min ─────────
  cleanExpired();
  const rateKey = `rate_${email.toLowerCase()}`;
  const existing = otpStore.get(rateKey);
  if (existing && existing.count >= 3) {
    return res.status(429).json({
      error: 'Too many OTP requests. Please wait a few minutes and try again.',
    });
  }

  // ── Store OTP with 5-minute expiry ─────────────────────
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  otpStore.set(`otp_${email.toLowerCase()}`, { otp: String(otp), expiresAt });

  // Update rate limit counter
  otpStore.set(rateKey, {
    count: (existing?.count || 0) + 1,
    expiresAt,
  });

  // ── Send email via Brevo REST API ──────────────────────
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const SENDER_EMAIL  = process.env.SENDER_EMAIL  || 'noreply@smartcrickai.com';
  const SENDER_NAME   = process.env.SENDER_NAME   || 'SmartCrick AI';

  if (!BREVO_API_KEY) {
    console.error('BREVO_API_KEY environment variable not set');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmartCrick AI — Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050508;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#047857,#10b981,#34d399);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">SmartCrick AI</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;font-weight:500;letter-spacing:0.5px;">TRAIN LIKE A CHAMPION</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#0d0d16;padding:40px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">
              <h2 style="margin:0 0 12px;color:#ffffff;font-size:22px;font-weight:700;">Verify your email</h2>
              <p style="margin:0 0 28px;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">
                Use the code below to complete your sign-in to SmartCrick AI. This code expires in <strong style="color:#34d399;">5 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <div style="background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(52,211,153,0.06));border:1px solid rgba(16,185,129,0.3);border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:rgba(255,255,255,0.45);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Your verification code</p>
                <div style="letter-spacing:12px;font-size:42px;font-weight:900;color:#10b981;font-family:'Courier New',Courier,monospace;margin:8px 0;">${otp}</div>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.35);font-size:12px;">Enter this code in the SmartCrick AI app</p>
              </div>

              <p style="margin:0 0 8px;color:rgba(255,255,255,0.45);font-size:13px;line-height:1.5;">
                If you didn't request this code, you can safely ignore this email. Someone may have typed your email by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#080810;border-radius:0 0 16px 16px;border:1px solid rgba(255,255,255,0.06);border-top:none;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:12px;line-height:1.6;">
                SmartCrick AI · Train Like a Champion<br>
                This is an automated message — please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email }],
        subject: `${otp} is your SmartCrick AI verification code`,
        htmlContent: emailHtml,
        textContent: `Your SmartCrick AI verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this, ignore this email.`,
        tags: ['otp', 'transactional'],
      }),
    });

    if (!brevoResponse.ok) {
      const errData = await brevoResponse.json().catch(() => ({}));
      console.error('Brevo API error:', brevoResponse.status, errData);
      return res.status(500).json({
        error: 'Failed to send verification email. Please try again.',
        details: errData?.message || `HTTP ${brevoResponse.status}`,
      });
    }

    console.log(`✅ OTP sent to ${email} (expires in 5 min)`);
    return res.status(200).json({
      success: true,
      message: 'Verification code sent! Check your inbox.',
      expiresIn: 300, // seconds
    });

  } catch (err) {
    console.error('Send OTP error:', err);
    return res.status(500).json({
      error: 'Network error sending email. Please try again.',
    });
  }
}
