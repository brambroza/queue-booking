import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  name: z.string().min(2),
  company_name: z.string().optional().nullable(),
  phone: z.string().min(8),
  email: z.string().email(),
  business_type: z.string().min(2),
  message: z.string().min(5),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin.from('contact_leads').insert({
      name: parsed.data.name,
      company_name: parsed.data.company_name ?? null,
      phone: parsed.data.phone,
      email: parsed.data.email,
      business_type: parsed.data.business_type,
      message: parsed.data.message,
      source: 'website',
      status: 'new',
    });

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
