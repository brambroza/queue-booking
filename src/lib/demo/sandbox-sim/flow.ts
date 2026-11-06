import type { BusinessScenario, ScenarioResource } from '@/lib/demo/scenarios/types';

/** Steps of the sandbox LIFF booking, in order. */
export type LiffStep = 'service' | 'resource' | 'party' | 'datetime' | 'confirm';

/**
 * Service points a service can use: resources with no `serviceKeys` serve
 * every service (same rule as `resourceServesService`).
 *
 * @param scenario - Business scenario.
 * @param serviceKey - Chosen service.
 */
export function eligibleResources(scenario: BusinessScenario, serviceKey: string): ScenarioResource[] {
  return scenario.resources.filter((r) => !r.serviceKeys || r.serviceKeys.length === 0 || r.serviceKeys.includes(serviceKey));
}

/**
 * Steps the visitor goes through for a service: the resource step only when the
 * shop asks for one and the service has points to pick, the party step only for
 * businesses that take a head count.
 *
 * @param scenario - Business scenario.
 * @param serviceKey - Chosen service (null before the first pick).
 * @returns Ordered steps, always starting with `service` and ending with `confirm`.
 */
export function stepsFor(scenario: BusinessScenario, serviceKey: string | null): LiffStep[] {
  const steps: LiffStep[] = ['service'];
  if (serviceKey && scenario.resourcePicker !== 'none' && eligibleResources(scenario, serviceKey).length > 0) steps.push('resource');
  if (scenario.partySize) steps.push('party');
  steps.push('datetime', 'confirm');
  return steps;
}

/**
 * Whether "ถัดไป" is enabled on a step.
 *
 * @param step - Current step.
 * @param picks - What the visitor has chosen so far.
 * @param scenario - Business scenario (a required resource blocks the step).
 */
export function canContinue(
  step: LiffStep,
  picks: { serviceKey: string | null; resourceCode: string | null; time: string | null },
  scenario: BusinessScenario,
): boolean {
  switch (step) {
    case 'service':
      return Boolean(picks.serviceKey);
    case 'resource':
      return scenario.resourcePicker !== 'required' || Boolean(picks.resourceCode);
    case 'datetime':
      return Boolean(picks.time);
    default:
      return true;
  }
}

/**
 * Which of the two stepper pills is active: 1 = choose what, 2 = choose when.
 *
 * @param step - Current step.
 */
export function stepperPill(step: LiffStep): 1 | 2 {
  return step === 'datetime' || step === 'confirm' ? 2 : 1;
}
