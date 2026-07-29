import { prisma } from "../../prisma/client";

const DEFAULT_COLUMNS = [
  { name: "To Do", position: 0 },
  { name: "In Progress", position: 1 },
  { name: "Done", position: 2 },
] as const;

export async function createDefaultColumns(projectId: string) {
  for (const col of DEFAULT_COLUMNS) {
    await prisma.projectColumn.create({
      data: {
        projectId,
        name: col.name,
        position: col.position,
      },
    });
  }
}
