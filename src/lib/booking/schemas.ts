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
  party_size: z.coerce.number().int().min(1).max(200).optional(),
  resource_id: z.string().uuid().optional().nullable(),
  note: z.string().optional().default(''),
  status: z.enum(['pending', 'pending_approval', 'confirmed', 'waiting', 'called', 'seating', 'serving', 'in_service', 'checked_in', 'completed', 'skipped', 'cancelled', 'no_show']).default('confirmed'),
});

export const bookingResourceSchema = z.object({
  resource_type: z.enum(['table', 'buffet_zone', 'meeting_room', 'counter', 'service_area']),
  resource_code: z.string().trim().min(1).max(40).optional().nullable(),
  resource_name: z.string().trim().min(1).max(120),
  capacity: z.coerce.number().int().min(1).max(1000).default(1),
  floor: z.string().trim().max(50).optional().nullable(),
  zone: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  active: z.coerce.boolean().default(true),
});

export const bookingResourceBulkSchema = z.object({
  resource_type: z.enum(['table', 'buffet_zone', 'meeting_room', 'counter', 'service_area']),
  branch_id: z.string().uuid().optional().nullable(),
  floor: z.string().trim().max(50).optional().nullable(),
  zone: z.string().trim().max(80).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(1000).default(1),
  mode: z.enum(['range', 'list']),
  prefix: z.string().trim().min(1).max(20).optional().nullable(),
  start_number: z.coerce.number().int().min(1).max(9999).optional().nullable(),
  end_number: z.coerce.number().int().min(1).max(9999).optional().nullable(),
  pad_length: z.coerce.number().int().min(0).max(6).optional().nullable(),
  code_list: z.array(z.string().trim().min(1).max(40)).optional(),
  name_prefix: z.string().trim().max(40).optional().nullable(),
  active: z.coerce.boolean().default(true),
});
