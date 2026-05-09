import { z } from 'zod';

export const registerSchema = z.object({
  company_name: z.string().min(2),
  shop_name: z.string().min(2),
  owner_name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
