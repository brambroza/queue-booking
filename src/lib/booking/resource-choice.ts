/**
 * Shop switch `shops.require_resource_choice`: when on, a LIFF customer must
 * pick a resource (court, room, trainer) instead of "ไม่ระบุ".
 *
 * Pure rules shared by the LIFF page and `/api/public/shop/[shopKey]/book`.
 * The rule only bites when the service actually has a resource to choose —
 * a service with no linked resources books exactly as before.
 */

import { filterResourcesForService, type ServiceLinked } from '@/lib/booking/resource-service-link';

/** Error code returned by `/book` when a required resource is missing. */
export const RESOURCE_REQUIRED_CODE = 'resource_required';

export type BranchScopedResource = ServiceLinked & { branch_id?: string | null };

/**
 * Resources a customer could pick for this branch + service: shop-wide
 * resources (no branch) and the branch's own, filtered by the service link.
 *
 * @param resources - Active, non-deleted resources of the shop.
 * @param branchId - Branch the customer booked at.
 * @param serviceId - Service the customer booked.
 * @returns The resources the LIFF picker would show.
 */
export function eligibleResourcesFor<T extends BranchScopedResource>(
  resources: T[],
  branchId: string,
  serviceId: string,
): T[] {
  return filterResourcesForService(
    resources.filter((r) => !r.branch_id || r.branch_id === branchId),
    serviceId,
  );
}

/**
 * Whether a booking must be refused because no resource was chosen.
 *
 * @param input.required - The shop switch `require_resource_choice`.
 * @param input.resourceId - The resource id the customer sent, if any.
 * @param input.partySize - Party size; > 0 lets the server auto-assign a table.
 * @param input.eligibleCount - How many resources the customer could have picked.
 * @returns true when the booking lacks a resource the shop requires.
 */
export function isResourceChoiceMissing(input: {
  required: boolean;
  resourceId?: string | null;
  partySize?: number | null;
  eligibleCount: number;
}): boolean {
  if (!input.required) return false;
  if (input.resourceId) return false;
  // Restaurants: the server picks a table from the party size.
  if (input.partySize && input.partySize > 0) return false;
  return input.eligibleCount > 0;
}

/**
 * Customer-facing message when the resource is missing.
 *
 * @param resourceLabel - Thai label of the resource type, e.g. "สนาม".
 * @returns e.g. "กรุณาเลือกสนามก่อนจอง".
 */
export function resourceRequiredMessage(resourceLabel: string): string {
  return `กรุณาเลือก${resourceLabel || 'ผู้ให้บริการ'}ก่อนจอง`;
}
