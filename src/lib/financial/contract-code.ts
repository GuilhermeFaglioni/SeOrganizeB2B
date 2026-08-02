export function contractCode(year: number, sequence: number): string {
  return `CTR-${year}-${String(sequence).padStart(4, "0")}`;
}
