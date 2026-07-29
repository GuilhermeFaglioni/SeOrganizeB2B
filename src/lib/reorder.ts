export function getInsertPosition(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return (after as number) / 2;
  if (after === null) return (before as number) + 1;
  return (before + after) / 2;
}

export function reindexColumns(orderedIds: string[]): { id: string; position: number }[] {
  return orderedIds.map((id, index) => ({ id, position: index * 1024 }));
}
