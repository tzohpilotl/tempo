import { describe, it, expect } from 'vitest';
import { reportNetworkFailure, reportNetworkSuccess, isNetworkFailing } from './networkStatus';

describe('networkStatus', () => {
  it('reportNetworkFailure marks the network as failing', () => {
    reportNetworkFailure();
    expect(isNetworkFailing()).toBe(true);
  });

  it('reportNetworkSuccess clears a failing state', () => {
    reportNetworkFailure();
    expect(isNetworkFailing()).toBe(true);

    reportNetworkSuccess();
    expect(isNetworkFailing()).toBe(false);
  });
});
