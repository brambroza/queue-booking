import { z } from 'zod';

export const registerSchema = z.object({
  company_name: z.string().min(2),
  shop_name: z.string().min(2),
  owner_name: z.string().min(2),
  /** Thai mobile only (06/08/09) — every shop owner has one. */
  phone: z.string().regex(/^0[689]\d{8}$/),
  email: z.string().email(),
  password: z.string().min(8),
  plan_name: z.string().trim().optional().default(''),
  /** Drives which service templates seed the new shop; also qualifies the lead. */
  business_category: z.string().trim().max(60).optional().default(''),
  /** First-touch campaign parameters captured on the landing page. */
  utm: z.record(z.string()).optional(),
  /** Separate PDPA consent to be shown on the landing page; never pre-ticked. */
  showcase_consent: z.boolean().optional().default(false),
  /** Bot protection: server-signed issue time, Turnstile token, honeypot (must stay empty). */
  form_token: z.string().max(100).optional().default(''),
  turnstile_token: z.string().max(2048).optional().default(''),
  company_website: z.string().max(500).optional().default(''),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
