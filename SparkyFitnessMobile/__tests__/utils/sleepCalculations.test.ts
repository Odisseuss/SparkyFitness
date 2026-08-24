import { toBedtimeWakeTimeDates } from '../../src/utils/sleepCalculations';

describe('toBedtimeWakeTimeDates', () => {
  test('same-day bedtime/wake (e.g. a nap) needs no rollover', () => {
    const { bed, wake } = toBedtimeWakeTimeDates('2026-08-24', '13:00', '14:30');
    expect(wake.getTime() - bed.getTime()).toBe(90 * 60 * 1000);
  });

  test('rolls bedtime back a day when it is chronologically after wake time (overnight sleep)', () => {
    const { bed, wake } = toBedtimeWakeTimeDates('2026-08-24', '22:30', '06:30');
    // bed lands on 2026-08-23T22:30, wake stays 2026-08-24T06:30 -> 8h apart.
    expect(wake.getTime() - bed.getTime()).toBe(8 * 60 * 60 * 1000);
    expect(bed.toISOString().slice(0, 10)).toBe('2026-08-23');
    expect(wake.toISOString().slice(0, 10)).toBe('2026-08-24');
  });
});
