import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { hitRateLimit } from '@/lib/security/rate-limit';
import { invalidateCache } from '@/lib/cache/kv';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { SheetReadError, sheetServiceAccountEmail } from '@/lib/signage/sheet/google-sheets';
import { isMissingTableError, loadSheetAddon, loadSheetSources, readSheetNow } from '@/lib/signage/sheet/sheet-feed-server';
import { isAddonActive, parseSpreadsheetId, spreadsheetUrl } from '@/lib/signage/sheet/sheet-source';

const BranchIdSchema = z.string().uuid().nullable();
const SheetNameSchema = z.string().trim().max(100).nullable().optional();

const PatchSchema = z
  .object({
    branch_id: BranchIdSchema,
    sheet_url: z.string().trim().min(1).max(500),
    sheet_name: SheetNameSchema,
    enabled: z.boolean(),
  })
  .strict();

const TestSchema = z
  .object({
    action: z.literal('test'),
    branch_id: BranchIdSchema.optional(),
    /** Test an unsaved link; omitted = the saved source of `branch_id`. */
    sheet_url: z.string().trim().min(1).max(500).optional(),
    sheet_name: SheetNameSchema,
  })
  .strict();

const ADDON_REQUIRED = {
  error: 'จอคิวจาก Google Sheet เป็นแพ็กเกจเสริม ติดต่อทีมงานเพื่อเปิดใช้งาน',
  code: 'addon_required',
};
const NOT_MIGRATED = { error: 'ฟีเจอร์นี้ยังไม่พร้อมใช้งานบนระบบ กรุณาแจ้งผู้ดูแลระบบ', code: 'not_migrated' };

/** `''` from the form means "first tab". */
function cleanSheetName(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

/**
 * Add-on state + this shop's sheet sources. Readable by every staff role
 * (the designer shows where the TV data comes from).
 */
export async function GET() {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const shopId = profile.shop_id as string;
    // Service role: both tables are written server side only; every read is pinned to the caller's shop.
    const admin = createAdminClient();
    const probe = await admin.from('signage_sheet_sources').select('id', { head: true, count: 'exact' }).eq('shop_id', shopId);
    if (probe.error && isMissingTableError(probe.error)) {
      return NextResponse.json({ data: { migrated: false, addon: null, sources: [], service_account_email: '' } });
    }

    const [addon, sources] = await Promise.all([loadSheetAddon(admin, shopId), loadSheetSources(admin, shopId)]);
    return NextResponse.json({
      data: {
        migrated: true,
        addon: { active: isAddonActive(addon, getTodayISOInBangkok()), expires_on: addon?.expires_on ?? null },
        service_account_email: sheetServiceAccountEmail(),
        sources: sources.map((s) => ({ ...s, sheet_url: spreadsheetUrl(s.spreadsheet_id) })),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Owner saves the sheet link of one scope (branch or shop-wide) and switches it on / off. */
export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = PatchSchema.parse(await req.json());
    const shopId = profile.shop_id as string;
    const admin = createAdminClient();

    const spreadsheetId = parseSpreadsheetId(body.sheet_url);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'ลิงก์ไม่ใช่ Google Sheet (ต้องขึ้นต้นด้วย https://docs.google.com/spreadsheets/d/…)', code: 'bad_url' }, { status: 400 });
    }
    // Switching off is always allowed, so an expired add-on can still be tidied up.
    if (body.enabled && !isAddonActive(await loadSheetAddon(admin, shopId), getTodayISOInBangkok())) {
      return NextResponse.json(ADDON_REQUIRED, { status: 402 });
    }
    if (body.branch_id) {
      const { data: branch } = await admin
        .from('branches')
        .select('id')
        .eq('id', body.branch_id)
        .eq('shop_id', shopId)
        .eq('is_deleted', false)
        .maybeSingle();
      if (!branch) return NextResponse.json({ error: 'ไม่พบสาขานี้' }, { status: 404 });
    }

    let existing = admin.from('signage_sheet_sources').select('id').eq('shop_id', shopId);
    existing = body.branch_id ? existing.eq('branch_id', body.branch_id) : existing.is('branch_id', null);
    const { data: current, error: currentError } = await existing.maybeSingle<{ id: string }>();
    if (currentError) {
      if (isMissingTableError(currentError)) return NextResponse.json(NOT_MIGRATED, { status: 400 });
      throw currentError;
    }

    const values = {
      spreadsheet_id: spreadsheetId,
      sheet_name: cleanSheetName(body.sheet_name),
      enabled: body.enabled,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = current
      ? await admin.from('signage_sheet_sources').update(values).eq('id', current.id).eq('shop_id', shopId).select('*').single()
      : await admin.from('signage_sheet_sources').insert({ ...values, shop_id: shopId, branch_id: body.branch_id }).select('*').single();
    if (error) throw error;

    await invalidateCache([`sheet-signage:${saved.id}:*`, `sheet-source:${shopId}:*`]);
    await writeAuditLog({
      companyId: profile.company_id,
      shopId,
      userId: user.id,
      action: 'signage_sheet_source_saved',
      targetTable: 'signage_sheet_sources',
      targetId: saved.id,
      payload: { branch_id: body.branch_id, spreadsheet_id: spreadsheetId, sheet_name: values.sheet_name, enabled: body.enabled },
    });
    return NextResponse.json({ data: { ...saved, sheet_url: spreadsheetUrl(spreadsheetId) } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** `action: 'test'` — read the sheet now (no cache) and show how today's rows are understood. */
export async function POST(req: Request) {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = TestSchema.parse(await req.json());
    const shopId = profile.shop_id as string;
    const admin = createAdminClient();
    const today = getTodayISOInBangkok();

    if (!isAddonActive(await loadSheetAddon(admin, shopId), today)) return NextResponse.json(ADDON_REQUIRED, { status: 402 });
    if (!(await hitRateLimit(admin, 'sheetSignageTest', shopId))) {
      return NextResponse.json({ error: 'ทดสอบบ่อยเกินไป กรุณารอสักครู่', code: 'rate_limited' }, { status: 429 });
    }

    let target: { spreadsheet_id: string; sheet_name: string | null } | null = null;
    if (body.sheet_url) {
      const id = parseSpreadsheetId(body.sheet_url);
      if (!id) return NextResponse.json({ error: 'ลิงก์ไม่ใช่ Google Sheet', code: 'bad_url' }, { status: 400 });
      target = { spreadsheet_id: id, sheet_name: cleanSheetName(body.sheet_name) };
    } else {
      const branchId = body.branch_id ?? null;
      target = (await loadSheetSources(admin, shopId)).find((s) => s.branch_id === branchId) ?? null;
    }
    if (!target) return NextResponse.json({ error: 'ยังไม่ได้บันทึกลิงก์ Sheet' }, { status: 400 });

    try {
      const parsed = await readSheetNow(target, today);
      return NextResponse.json({
        data: {
          ok: !parsed.error,
          error: parsed.error,
          today,
          found: parsed.found,
          today_count: parsed.rows.length,
          skipped: parsed.skipped.slice(0, 20),
          skipped_count: parsed.skipped.length,
          preview: parsed.rows.slice(0, 10).map((r) => {
            const customer = Array.isArray(r.customers) ? r.customers[0] : r.customers;
            const service = Array.isArray(r.services) ? r.services[0] : r.services;
            return {
              queue_number: r.queue_number,
              status: r.status,
              name: customer?.nickname ?? customer?.full_name ?? null,
              service: service?.service_name ?? null,
              room: r.resource_name,
              time: r.start_time,
              emergency: r.priority === 'emergency',
            };
          }),
        },
      });
    } catch (e) {
      if (e instanceof SheetReadError) {
        return NextResponse.json({ data: { ok: false, error: e.message, code: e.code, today, found: [], today_count: 0, skipped: [], skipped_count: 0, preview: [] } });
      }
      throw e;
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
