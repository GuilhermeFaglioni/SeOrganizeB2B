export interface TimeRange {
  startTime: string;
  endTime: string;
}

export function eventsOverlap(a: TimeRange, b: TimeRange): boolean {
  const aStart = new Date(a.startTime).getTime();
  const aEnd = new Date(a.endTime).getTime();
  const bStart = new Date(b.startTime).getTime();
  const bEnd = new Date(b.endTime).getTime();
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return aStart < bEnd && aEnd > bStart;
}
