// ═══════════════════════════════════════════════════════════
// SmartCrick AI — OTP Email Handler (Gmail SMTP)
// No custom domain needed. Sends from Gmail directly.
// Free up to 500 emails/day via Gmail App Password.
// ═══════════════════════════════════════════════════════════

// In-memory OTP store with 5-min expiry + rate limiting
const otpStore = new Map();

function cleanExpired() {
  const now = Date.now();
  for (const [k, v] of otpStore.entries()) {
    if (now > v.expiresAt) otpStore.delete(k);
  }
}

// Send email via Gmail SMTP using raw fetch to Google's OAuth endpoint
// We use nodemailer-style SMTP over fetch isn't possible — 
// instead we use the Gmail API which supports App Passwords via SMTP
// Actually we'll use a lightweight SMTP approach via the smtp module

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp, name } = req.body || {};

  if (!email || !otp)
    return res.status(400).json({ error: 'Email and OTP are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address.' });
  if (!/^\d{6}$/.test(String(otp)))
    return res.status(400).json({ error: 'OTP must be exactly 6 digits.' });

  cleanExpired();
  const rateKey  = `rate_${email.toLowerCase()}`;
  const existing = otpStore.get(rateKey);
  const TTL      = 5 * 60 * 1000;

  if (existing && existing.count >= 3)
    return res.status(429).json({ error: 'Too many requests. Please wait a few minutes.' });

  const expiresAt = Date.now() + TTL;
  otpStore.set(`otp_${email.toLowerCase()}`, { otp: String(otp), expiresAt });
  otpStore.set(rateKey, { count: (existing?.count || 0) + 1, expiresAt });

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

  if (!GMAIL_USER || !GMAIL_PASS) {
    console.error('GMAIL_USER or GMAIL_APP_PASSWORD not set');
    return res.status(500).json({ error: 'Email service not configured.' });
  }

  const firstName = name
    ? name.trim().split(' ')[0].charAt(0).toUpperCase() + name.trim().split(' ')[0].slice(1)
    : null;

  const otpDisplay = `${String(otp).slice(0,3)} ${String(otp).slice(3)}`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SmartCrick AI — Verify Your Email</title>
<style>
  body{margin:0;padding:0;background:#06060f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}
  @media only screen and (max-width:600px){
    .card-body{padding:32px 24px!important;}
    .otp-code{font-size:44px!important;letter-spacing:10px!important;}
    .headline{font-size:24px!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#06060f;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#06060f;padding:44px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#065f46 0%,#047857 22%,#059669 52%,#10b981 80%,#34d399 100%);border-radius:20px 20px 0 0;padding:36px 44px 32px;">
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:rgba(255,255,255,0.18);border-radius:14px;width:52px;height:52px;text-align:center;vertical-align:middle;border:1.5px solid rgba(255,255,255,0.28);">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:13px auto;">
            <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </td>
        <td style="padding-left:16px;vertical-align:middle;">
          <div style="font-size:23px;font-weight:900;color:#ffffff;letter-spacing:-0.4px;">SmartCrick AI</div>
          <div style="font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.65);letter-spacing:2.8px;text-transform:uppercase;margin-top:4px;">Complete Cricket Training Ecosystem</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- BODY -->
  <tr><td class="card-body" style="background:#0d0d1a;padding:44px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">

    <h1 class="headline" style="margin:0 0 12px;color:#ffffff;font-size:27px;font-weight:900;letter-spacing:-0.5px;line-height:1.25;">
      ${firstName ? `${firstName}, you're one step from the pitch.` : 'One step from the pitch.'}
    </h1>
    <p style="margin:0 0 32px;color:rgba(255,255,255,0.52);font-size:15px;line-height:1.75;">
      ${firstName
        ? `Welcome to SmartCrick AI. Enter the code below to verify your email and unlock your complete cricket training ecosystem.`
        : `Enter the verification code below to access your SmartCrick AI training dashboard — AI coaching, drills, mental training, and more.`
      }
    </p>

    <!-- OTP BOX -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr><td style="background:linear-gradient(135deg,rgba(16,185,129,0.10),rgba(52,211,153,0.04));border:1.5px solid rgba(16,185,129,0.3);border-radius:18px;padding:36px 24px;text-align:center;">
        <div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:800;letter-spacing:3.5px;text-transform:uppercase;margin-bottom:16px;">Verification Code</div>
        <div class="otp-code" style="color:#10b981;font-size:54px;font-weight:900;letter-spacing:14px;font-family:'Courier New',Courier,monospace;line-height:1;">${otpDisplay}</div>
        <table cellpadding="0" cellspacing="0" align="center" style="margin:18px auto 0;">
          <tr><td style="background:rgba(16,185,129,0.11);border:1px solid rgba(16,185,129,0.26);border-radius:99px;padding:7px 22px;">
            <span style="color:#34d399;font-size:12px;font-weight:800;">Valid for 5 minutes only</span>
          </td></tr>
        </table>
      </td></tr>
    </table>

    <!-- FEATURES -->
    <p style="margin:0 0 14px;color:rgba(255,255,255,0.28);font-size:10px;font-weight:800;letter-spacing:2.8px;text-transform:uppercase;">
      ${firstName ? `Everything waiting for you, ${firstName}` : 'Your complete training ecosystem'}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td width="50%" style="padding:4px 5px 4px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;">
            <span style="color:#10b981;font-size:12px;margin-right:8px;font-weight:900;">&#10003;</span>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;">AI Cricket Coach</span>
          </td></tr></table>
        </td>
        <td width="50%" style="padding:4px 0 4px 5px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;">
            <span style="color:#10b981;font-size:12px;margin-right:8px;font-weight:900;">&#10003;</span>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;">Complete Drill Library</span>
          </td></tr></table>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:4px 5px 4px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;">
            <span style="color:#10b981;font-size:12px;margin-right:8px;font-weight:900;">&#10003;</span>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;">Mental Training</span>
          </td></tr></table>
        </td>
        <td width="50%" style="padding:4px 0 4px 5px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;">
            <span style="color:#10b981;font-size:12px;margin-right:8px;font-weight:900;">&#10003;</span>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;">Fitness Builder</span>
          </td></tr></table>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:4px 5px 4px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;">
            <span style="color:#10b981;font-size:12px;margin-right:8px;font-weight:900;">&#10003;</span>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;">MiniMatch Scenarios</span>
          </td></tr></table>
        </td>
        <td width="50%" style="padding:4px 0 4px 5px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;">
            <span style="color:#10b981;font-size:12px;margin-right:8px;font-weight:900;">&#10003;</span>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;">30-Day Challenge</span>
          </td></tr></table>
        </td>
      </tr>
    </table>

    <!-- SECURITY NOTE -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px 20px;">
        <p style="margin:0;color:rgba(255,255,255,0.33);font-size:12.5px;line-height:1.65;">
          <strong style="color:rgba(255,255,255,0.48);">Didn't try to sign in?</strong>&nbsp;
          Just ignore this email — your account is completely safe. This code cannot be used without access to your device.
        </p>
      </td></tr>
    </table>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#08080e;border-radius:0 0 20px 20px;border:1px solid rgba(255,255,255,0.06);border-top:none;padding:22px 44px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="margin:0 0 3px;color:rgba(255,255,255,0.3);font-size:12px;font-weight:700;">SmartCrick AI &mdash; Train Like a Champion</p>
          <p style="margin:0;color:rgba(255,255,255,0.15);font-size:11px;">Automated security email &mdash; please do not reply.</p>
        </td>
        <td align="right" valign="middle">
          <div style="background:linear-gradient(135deg,#047857,#10b981);border-radius:9px;padding:6px 14px;display:inline-block;">
            <span style="color:#fff;font-size:11px;font-weight:900;letter-spacing:0.8px;">SC AI</span>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const textContent = [
    `SmartCrick AI — Verify Your Email`,
    ``,
    firstName ? `Hi ${firstName},` : `Hi there,`,
    ``,
    `Your verification code: ${otpDisplay}`,
    ``,
    `This code expires in 5 minutes.`,
    ``,
    `If you didn't request this, just ignore this email.`,
    ``,
    `SmartCrick AI · Train Like a Champion`,
  ].join('\n');

  // ── Send via Gmail SMTP using raw HTTP to Gmail's API ──────
  // We use the Gmail API with OAuth2 isn't feasible here without refresh tokens
  // Instead we use nodemailer via dynamic import (available in Vercel Node.js)
  try {
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.default.createTransport({
      host:   'smtp.gmail.com',
      port:   587,
      secure: false, // TLS
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS, // App Password (not regular password)
      },
    });

    // Verify connection before sending
    await transporter.verify();

    await transporter.sendMail({
      from:    `"SmartCrick AI" <${GMAIL_USER}>`,
      to:      email,
      subject: firstName
        ? `${firstName}, your SmartCrick AI code is ${otpDisplay}`
        : `${otpDisplay} — Your SmartCrick AI verification code`,
      html:    htmlContent,
      text:    textContent,
    });

    console.log(`OTP sent via Gmail → ${email}`);
    return res.status(200).json({
      success:   true,
      message:   'Code sent! Check your inbox.',
      expiresIn: 300,
    });

  } catch (err) {
    console.error('Gmail send error:', err.message);

    // Helpful error messages for common issues
    if (err.message.includes('Invalid login') || err.message.includes('Username and Password')) {
      return res.status(500).json({
        error: 'Gmail authentication failed. Check GMAIL_USER and GMAIL_APP_PASSWORD in Vercel settings.',
      });
    }
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
      return res.status(500).json({
        error: 'Could not connect to email server. Please try again.',
      });
    }

    return res.status(500).json({
      error: 'Could not send verification email. Please try again.',
    });
  }
}
