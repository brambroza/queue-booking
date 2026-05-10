import { z } from 'zod';

export const branchSchema = z.object({
  branch_name: z.string().min(2),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  open_time: z.string(),
  close_time: z.string(),
  max_parallel_queues: z.coerce.number().int().min(1).max(100),
  active: z.coerce.boolean().default(true),
});

export const serviceSchema = z.object({
  service_name: z.string().min(2),
  booking_mode: z.enum(['fixed_slot', 'flexible_duration', 'capacity_based', 'walk_in', 'request_approval']).default('fixed_slot'),
  duration_minutes: z.coerce.number().int().min(5).optional().nullable(),
  min_duration_minutes: z.coerce.number().int().min(5).optional().nullable(),
  max_duration_minutes: z.coerce.number().int().min(5).optional().nullable(),
  capacity_per_slot: z.coerce.number().int().min(1).default(1),
  requires_approval: z.coerce.boolean().default(false),
  allow_walk_in: z.coerce.boolean().default(false),
  price: z.coerce.number().nonnegative(),
  active: z.coerce.boolean().default(true),
});

export const workingHourSchema = z.object({
  branch_id: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  open_time: z.string(),
  close_time: z.string(),
  break_start: z.string().nullable().optional(),
  break_end: z.string().nullable().optional(),
  slot_interval_minutes: z.coerce.number().int().min(5).max(180),
  capacity_per_slot: z.coerce.number().int().min(1).max(100),
  active: z.coerce.boolean().default(true),
});

export const bookingSchema = z.object({
  branch_id: z.string().uuid(),
  service_id: z.string().uuid(),
  customer_name: z.string().min(2),
  customer_phone: z.string().min(8),
  line_user_pk: z.string().uuid().optional(),
  line_user_external_id: z.string().optional(),
  booking_date: z.string(),
  start_time: z.string(),
  note: z.string().optional().default(''),
  status: z.enum(['pending', 'confirmed', 'waiting', 'serving', 'completed', 'cancelled', 'no_show']).default('confirmed'),
});
