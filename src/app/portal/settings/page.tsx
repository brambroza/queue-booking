import { PageShell } from '@/components/ui/page-shell';
import { SettingsCrud } from '@/components/forms/settings-crud';

export default function SettingsPage() {
  return (
    <PageShell title="Settings" description="จัดการโปรไฟล์ร้านค้า โลโก้ และค่า config ของระบบ">
      <SettingsCrud />
    </PageShell>
  );
}
