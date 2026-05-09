import { PageShell } from '@/components/ui/page-shell';
import { SettingsCrud } from '@/components/forms/settings-crud';

export default function SettingsPage() {
  return (
    <PageShell title="Settings" description="จัดการค่า config ของร้าน (JSON)">
      <SettingsCrud />
    </PageShell>
  );
}
