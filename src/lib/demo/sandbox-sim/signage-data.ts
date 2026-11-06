import type { BusinessScenario } from '@/lib/demo/scenarios/types';
import { DEFAULT_SIGNAGE_CONFIG } from '@/lib/signage/settings';
import { buildSignageData, type SignageBookingRow } from '@/lib/signage/normalize';
import type { SignageConfig, SignageData } from '@/lib/signage/types';
import { queueEndTime } from './reducer';
import type { SimQueue } from './types';

/** Statuses the TV never shows (not yet confirmed, or gone). */
const HIDDEN_ON_TV: ReadonlySet<string> = new Set(['pending_approval', 'cancelled', 'no_show']);

/**
 * Signage settings for a scenario: its template and theme, names unmasked
 * (the TV in a sandbox shows what the visitor typed), no QR, landscape.
 *
 * @param scenario - Business scenario.
 */
export function sandboxSignageConfig(scenario: BusinessScenario): SignageConfig {
  return {
    ...DEFAULT_SIGNAGE_CONFIG,
    template: scenario.signage.template,
    theme: scenario.signage.theme,
    customer_name_mode: 'full',
    show_qr: false,
    show_logo: false,
  };
}

/**
 * Turn the sandbox queues of today into the payload `SignageBoard` renders,
 * through the same `buildSignageData` the real TV route uses.
 *
 * @param scenario - Business scenario.
 * @param queues - Every queue in the sandbox.
 * @param today - Bangkok date shown on the TV.
 * @returns Signage payload.
 */
export function buildSandboxSignageData(scenario: BusinessScenario, queues: SimQueue[], today: string): SignageData {
  const config = sandboxSignageConfig(scenario);
  const base = Date.UTC(2000, 0, 1);
  const rows: SignageBookingRow[] = queues
    .filter((q) => q.date === today && !HIDDEN_ON_TV.has(q.status))
    .map((q) => {
      const service = scenario.services.find((s) => s.key === q.serviceKey);
      const resource = q.resourceCode ? scenario.resources.find((r) => r.code === q.resourceCode) : undefined;
      return {
        id: q.id,
        queue_number: q.queueNo,
        status: q.status,
        start_time: q.time,
        end_time: queueEndTime(q),
        // Only the order matters to the board, so a call counter becomes a timestamp.
        called_at: q.calledSeq === null ? null : new Date(base + q.calledSeq * 1000).toISOString(),
        resource_name: resource?.name ?? null,
        branch_id: null,
        customers: { full_name: q.customerName, nickname: q.nickname ?? null },
        line_users: null,
        services: { service_name: service?.name ?? null },
      };
    });
  return buildSignageData({
    rows,
    config,
    date: today,
    shop: { name: scenario.shopName, logo_url: null, demo_mode_enabled: false },
    branch: { id: 'sandbox-branch', name: scenario.branchName },
    resources: scenario.resources.map((r) => ({ id: r.code, name: r.name })),
  });
}
