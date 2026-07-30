import { prisma } from "../../prisma/client";

const DEFAULT_COLUMNS = [
  { name: "To Do", position: 0, completesTasks: false },
  { name: "In Progress", position: 1, completesTasks: false },
  { name: "Done", position: 2, completesTasks: true },
] as const;

export async function createDefaultColumns(projectId: string) {
  for (const col of DEFAULT_COLUMNS) {
    await prisma.projectColumn.create({
      data: {
        projectId,
        name: col.name,
        position: col.position,
        completesTasks: col.completesTasks,
      },
    });
  }
}
