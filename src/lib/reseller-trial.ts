export const DEFAULT_TRIAL_SEAT_HOURS = 5;

export function trialSeatHoursLabel(hours = DEFAULT_TRIAL_SEAT_HOURS) {
  const value = Math.max(0.25, Number(hours) || DEFAULT_TRIAL_SEAT_HOURS);
  if (value < 1) {
    const minutes = Math.round(value * 60);
    return minutes === 1 ? "1 min" : `${minutes} min`;
  }
  if (Number.isInteger(value)) return value === 1 ? "1 hour" : `${value} hours`;
  return `${value}h`;
}

export function resellerClientTrialExpiryFromNow(
  hours = DEFAULT_TRIAL_SEAT_HOURS,
  now = Date.now(),
) {
  const value = Math.max(0.25, Math.min(720, Number(hours) || DEFAULT_TRIAL_SEAT_HOURS));
  return new Date(now + value * 60 * 60 * 1000).toISOString();
}

export function normalizeTrialSeatHours(raw: unknown) {
  return Math.max(0.25, Math.min(720, Number(raw) || DEFAULT_TRIAL_SEAT_HOURS));
}
