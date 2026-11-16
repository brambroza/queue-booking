import { z } from 'zod';
import { MAX_USAGE_WINDOWS } from './rules';

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Invalid time');

/** One usage window of a package; `00:00` as `time_to` = end of day. */
export const usageWindowSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6).nullable().default(null),
    time_from: timeOfDay,
    time_to: timeOfDay,
    rate: z.coerce.number().min(0.1).max(10).default(1),
  })
  .refine((w) => w.time_from < w.time_to || w.time_to.startsWith('00:00'), { message: 'time_from must be before time_to', path: ['time_to'] });

/** Body of `POST /api/packages` (create a package template). */
export const creditPackageSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish().transform((v) => v || null),
  credit_minutes: z.coerce.number().int().min(1).max(100000),
  price: z.coerce.number().min(0).max(10_000_000),
  valid_days: z.coerce.number().int().min(1).max(3650).nullable().default(null),
  service_ids: z.array(z.string().uuid()).max(100).nullable().default(null),
  usage_windows: z.array(usageWindowSchema).max(MAX_USAGE_WINDOWS).default([]),
  sell_online: z.coerce.boolean().default(true),
  active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});

/** Body of `PATCH /api/packages` (every field optional but `id`). */
export const creditPackagePatchSchema = creditPackageSchema.partial().extend({ id: z.string().uuid() });

/** Body of `POST /api/customer-packages` (staff sells a package at the counter). */
export const sellPackageSchema = z.object({
  customer_id: z.string().uuid(),
  package_id: z.string().uuid(),
  /** Defaults to the template price. */
  price_paid: z.coerce.number().min(0).max(10_000_000).optional(),
  payment_method: z.enum(['cash', 'bank_transfer', 'other']).default('cash'),
  payment_note: z.string().trim().max(300).nullish().transform((v) => v || null),
});

/** Body of `PATCH /api/customer-packages`. */
export const customerPackageActionSchema = z.discriminatedUnion('action', [
  z.object({ id: z.string().uuid(), action: z.literal('approve') }),
  z.object({ id: z.string().uuid(), action: z.literal('reject'), reason: z.string().trim().min(1).max(300) }),
  z.object({
    id: z.string().uuid(),
    action: z.literal('adjust'),
    minutes: z.coerce.number().int().min(-100000).max(100000).refine((v) => v !== 0, 'minutes must not be 0'),
    reason: z.string().trim().min(1).max(300),
  }),
  z.object({ id: z.string().uuid(), action: z.literal('cancel'), reason: z.string().trim().min(1).max(300) }),
]);
