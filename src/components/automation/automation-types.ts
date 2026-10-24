/** Shape of `GET /api/automation` `data`, shared by the dashboard card and the settings card. */
export type AutomationSummary = {
  migrated: boolean;
  settings: {
    followup_enabled: boolean;
    followup_delay_minutes: number;
    google_review_url: string | null;
    winback_enabled: boolean;
    winback_default_days: number;
    automation_monthly_cap: number;
  };
  plan: { code: string | null; winback_allowed: boolean };
  cap: { limit: number; used: number; starter_ceiling: boolean };
  roi: Record<'followup' | 'winback' | 'total', { sent: number; converted: number; revenue: number }>;
  preview: { overdue: number; reachable: number; estimatedBaht: number };
};

/** Thai baht without decimals, e.g. "฿2,400". */
export function formatBaht(value: number): string {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}
