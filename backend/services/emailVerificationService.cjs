const { sendEmail } = require('./emailService.cjs');

const requestVerification = async ({ email }) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await sendEmail({
    to: email,
    subject: 'Verify your email — Prime ERP',
    text: `Your verification code is: ${code}\n\nThis code expires in 30 minutes.\n\n— Prime ERP System`,
    html: `<div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#1e293b;margin:0 0 16px;">Verify your email</h2>
      <p style="color:#475569;margin:0 0 24px;">Use the code below to verify your email address:</p>
      <div style="background:#f1f5f9;padding:16px 24px;border-radius:8px;text-align:center;font-size:28px;font-weight:700;letter-spacing:6px;color:#0f172a;">${code}</div>
      <p style="color:#94a3b8;font-size:13px;margin:16px 0 0;">This code expires in 30 minutes.</p>
    </div>`,
  });
  return { success: true, code, expiresAt };
};

const verifyCode = async ({ email, code }) => null;
const findLatestPending = async () => null;
const sendVerificationEmail = async (email) => requestVerification({ email });

module.exports = {
  requestVerification,
  verifyCode,
  findLatestPending,
  sendVerificationEmail,
};
