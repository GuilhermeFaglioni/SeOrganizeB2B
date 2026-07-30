export type RecurrenceType = "daily" | "weekly" | "monthly";

export function nextRecurrenceDate(
  base: Date,
  type: RecurrenceType,
  interval: number
): Date {
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    throw new Error("Recurrence interval must be an integer from 1 to 365");
  }
  const next = new Date(base);
  if (type === "daily") {
    next.setUTCDate(next.getUTCDate() + interval);
    return next;
  }
  if (type === "weekly") {
    next.setUTCDate(next.getUTCDate() + interval * 7);
    return next;
  }
  if (type !== "monthly") {
    throw new Error("Unsupported recurrence type");
  }

  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + interval);
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
  ).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}
