import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { buildDetailTable, sendSalesEmail } from '@/lib/notifications/sales-email';

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'won', 'lost']),
});

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  company_name: z.string().trim().max(150).optional().nullable(),
  phone: z.string().trim().min(8).max(25),
  email: z.string().trim().email().max(150),
  business_type: z.string().trim().min(2).max(120),
  message: z.string().trim().min(5).max(2000),
  website: z.string().optional().default(''),
});

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    if (parsed.data.website) return NextResponse.json({ data: true });

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

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ error: 'contact_leads table is missing. Please run migrations.' }, { status: 503 });
      }
      throw error;
    }

    // A lead sitting unread in Postgres is a lost lead. Notify sales immediately;
    // failure here must not fail the submission the visitor just made.
    await sendSalesEmail({
      subject: `Contact Lead: ${parsed.data.name} (${parsed.data.company_name ?? parsed.data.business_type})`,
      html: buildDetailTable('New Contact Lead', [
        ['Name', parsed.data.name],
        ['Company', parsed.data.company_name],
        ['Business Type', parsed.data.business_type],
        ['Phone', parsed.data.phone],
        ['Email', parsed.data.email],
        ['Message', parsed.data.message],
        ['Received At', new Date().toISOString()],
      ]),
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    console.log("error::>>" , e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

/** Sales inbox for website enquiries. */
export async function GET(req: Request) {
  try {
    await requireAuthContext({ roles: ['super_admin'] });

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const admin = createAdminClient();
    let query = admin.from('contact_leads').select('*').order('created_at', { ascending: false }).limit(200);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Moves a lead through new → contacted → won/lost. */
export async function PATCH(req: Request) {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const body = updateSchema.parse(await req.json());

    const admin = createAdminClient();
    const { error } = await admin.from('contact_leads').update({ status: body.status }).eq('id', body.id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
