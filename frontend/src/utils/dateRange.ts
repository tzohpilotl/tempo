export interface DateRange {
  from: string;
  to: string;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Today, from local midnight to the next local midnight. */
export function getDayRange(): DateRange {
  const from = startOfDay(new Date());
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** The current calendar week (Monday–Sunday), in local time. */
export function getWeekRange(): DateRange {
  const today = startOfDay(new Date());
  const daysSinceMonday = (today.getDay() + 6) % 7; // getDay(): 0=Sun..6=Sat
  const from = new Date(today);
  from.setDate(from.getDate() - daysSinceMonday);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** The current calendar month, in local time. */
export function getMonthRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
