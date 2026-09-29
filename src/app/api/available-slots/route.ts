import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { assertBranchAllowed } from '@/lib/auth/branch-scope';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import { bookingWindowMessage, getBranchBookingWindow, isBeyondBookingWindow, resolveMaxBookingDate } from '@/lib/booking/booking-window';

export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);

    const branchId = searchParams.get('branch_id');
    const serviceId = searchParams.get('service_id');
    const date = searchParams.get('date');
    const resourceType = searchParams.get('resource_type');
    const resourceId = searchParams.get('resource_id');
    const partySize = searchParams.get('party_size');

    if (!branchId || !serviceId || !date) {
      return NextResponse.json({ error: 'Missing branch_id, service_id or date' }, { status: 400 });
    }
    assertBranchAllowed(branchScope, branchId);

    // Staff follow the branch's advance-booking window too: no slots past it.
    const maxDate = resolveMaxBookingDate(
      toBangkokStamp(new Date()).date,
      await getBranchBookingWindow(supabase, profile.shop_id, branchId),
    );
    if (maxDate && isBeyondBookingWindow(date, maxDate)) {
      return NextResponse.json({ data: [], meta: { reason: 'beyond_window', hint: bookingWindowMessage(maxDate), max_date: maxDate } });
    }

    const { data, error } = await supabase.rpc('get_available_slots', {
      p_shop_id: profile.shop_id,
      p_branch_id: branchId,
      p_service_id: serviceId,
      p_date: date,
      p_resource_type: resourceType || null,
      p_party_size: partySize ? Number(partySize) : null,
      p_resource_id: resourceId || null,
    });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
