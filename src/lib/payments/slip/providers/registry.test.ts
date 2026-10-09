import { afterEach, describe, expect, it } from 'vitest';
import { isSlipProviderAvailable, listSlipProviders, parseSlipProviderId, platformSlipProviderId } from './registry';

const ORIGINAL = { flag: process.env.SLIP_VERIFY_EASYSLIP_ENABLED, provider: process.env.SLIP_VERIFY_PROVIDER };

afterEach(() => {
  if (ORIGINAL.flag === undefined) delete process.env.SLIP_VERIFY_EASYSLIP_ENABLED; else process.env.SLIP_VERIFY_EASYSLIP_ENABLED = ORIGINAL.flag;
  if (ORIGINAL.provider === undefined) delete process.env.SLIP_VERIFY_PROVIDER; else process.env.SLIP_VERIFY_PROVIDER = ORIGINAL.provider;
});

describe('slip provider registry', () => {
  it('defaults EasySlip on and honours the kill switch', () => {
    delete process.env.SLIP_VERIFY_EASYSLIP_ENABLED;
    expect(isSlipProviderAvailable('easyslip')).toBe(true);
    process.env.SLIP_VERIFY_EASYSLIP_ENABLED = 'false';
    expect(isSlipProviderAvailable('easyslip')).toBe(false);
    expect(listSlipProviders()).toEqual([{ provider: 'easyslip', displayName: 'EasySlip', available: false }]);
  });

  it('narrows unknown ids', () => {
    expect(parseSlipProviderId('easyslip')).toBe('easyslip');
    expect(parseSlipProviderId('slipok')).toBeNull();
    expect(parseSlipProviderId(1)).toBeNull();
  });

  it('reads the platform vendor from env, case-insensitively, and respects the switch', () => {
    delete process.env.SLIP_VERIFY_PROVIDER;
    expect(platformSlipProviderId()).toBeNull();
    process.env.SLIP_VERIFY_PROVIDER = 'EasySlip';
    delete process.env.SLIP_VERIFY_EASYSLIP_ENABLED;
    expect(platformSlipProviderId()).toBe('easyslip');
    process.env.SLIP_VERIFY_EASYSLIP_ENABLED = '0';
    expect(platformSlipProviderId()).toBeNull();
    process.env.SLIP_VERIFY_PROVIDER = 'unknown';
    expect(platformSlipProviderId()).toBeNull();
  });
});
