import { redirect } from 'next/navigation';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { LiffThemeScope } from '@/components/line/liff-theme-scope';
import { LiffSection, LiffShell } from '@/components/line/liff-ui';

export default async function LiffBookingClientEntry({
  searchParams,
}: {
  searchParams: Promise<{ shopKey?: string; shop_key?: string; shopId?: string; shop_id?: string; tab?: string; view?: string; booking_id?: string }>;
}) {
  const qs = await searchParams;
  const ref = qs.shopKey ?? qs.shop_key ?? qs.shopId ?? qs.shop_id;
  const tab = (qs.tab ?? qs.view ?? '').toLowerCase();

  // Payment Flex links carry `booking_id`; the LIFF page opens that queue's payment panel.
  const query = qs.booking_id ? `?booking_id=${encodeURIComponent(qs.booking_id)}` : '';

  if (ref) {
    if (tab === 'account' || tab === 'member') {
      redirect(`/liff/${encodeURIComponent(ref)}/member${query}`);
    }
    redirect(`/liff/${encodeURIComponent(ref)}${query}`);
  }

  return (
    <LiffThemeScope>
      <LiffShell title="LIFF Booking">
        <Alert severity="error">ลิงก์นี้ต้องมี shop_key หรือ shop_id เพื่อระบุร้านค้า</Alert>
        <LiffSection title="รูปแบบลิงก์ที่ถูกต้อง">
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'ui-monospace, monospace' }}>
              /liff/booking-client?shop_key=SHOP-XXXXXX
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'ui-monospace, monospace' }}>
              /liff/booking-client?shop_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
            </Typography>
          </Stack>
        </LiffSection>
        <Button variant="outlined" fullWidth href="/">กลับหน้าหลัก</Button>
      </LiffShell>
    </LiffThemeScope>
  );
}
