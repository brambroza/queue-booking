export type CustomerEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type CustomerEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: CustomerEmailAttachment[];
};

export type CustomerEmailResult =
  | { ok: true; via: 'smtp' | 'resend' }
  | { ok: false; reason: 'not_configured' | 'failed' };

/** One line only: a stray CR/LF in a subject built from a shop name would inject headers. */
export function sanitizeSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

/**
 * Sends an email to a customer (a shop owner), unlike `sendSalesEmail` which only
 * talks to our own inbox. SMTP first; Resend only when a verified sender is
 * configured, because Resend's shared sandbox sender delivers to the account
 * owner alone and would silently "succeed" without reaching the customer.
 *
 * Never throws. The caller learns what happened from the result and is
 * responsible for telling the operator, since a sent-looking button with no
 * delivery is worse than an error.
 *
 * @param email - Message to send; `to` must already be validated.
 */
export async function sendCustomerEmail(email: CustomerEmail): Promise<CustomerEmailResult> {
  const subject = sanitizeSubject(email.subject);

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM_EMAIL ?? user;
  if (user && pass && from) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: String(process.env.SMTP_SECURE ?? 'true') === 'true',
        auth: { user, pass },
      });
      await transporter.sendMail({
        from,
        to: email.to,
        subject,
        html: email.html,
        text: email.text,
        attachments: email.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      });
      return { ok: true, via: 'smtp' };
    } catch (err) {
      console.warn('[customer-email] smtp failed:', err instanceof Error ? err.message : err);
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;
  if (apiKey && resendFrom) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: resendFrom,
          to: [email.to],
          subject,
          html: email.html,
          text: email.text,
          attachments: email.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString('base64') })),
        }),
      });
      if (res.ok) return { ok: true, via: 'resend' };
      console.warn(`[customer-email] resend failed ${res.status}: ${await res.text()}`);
      return { ok: false, reason: 'failed' };
    } catch (err) {
      console.warn('[customer-email] resend failed:', err instanceof Error ? err.message : err);
      return { ok: false, reason: 'failed' };
    }
  }

  const smtpConfigured = Boolean(user && pass && from);
  return { ok: false, reason: smtpConfigured ? 'failed' : 'not_configured' };
}
