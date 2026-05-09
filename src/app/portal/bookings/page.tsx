import { PageShell } from '@/components/ui/page-shell';
import { BookingsCrud } from '@/components/forms/bookings-crud';

export default function BookingsPage() {
  return (
    <PageShell title="Bookings" description="จัดการคิวแบบ MVP (List View)">
      <BookingsCrud />
    </PageShell>
  );
}
