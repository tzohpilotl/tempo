import type { TrackingSummaryResponse } from '../types';

export type TrackingPeriod = keyof TrackingSummaryResponse;

export const TRACKING_PERIODS: Array<{ key: TrackingPeriod; label: string }> = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'allTime', label: 'All time' },
];

export function isTrackingPeriod(value: string | undefined): value is TrackingPeriod {
  return TRACKING_PERIODS.some((p) => p.key === value);
}

export function trackingPeriodLabel(period: TrackingPeriod): string {
  return TRACKING_PERIODS.find((p) => p.key === period)!.label;
}
