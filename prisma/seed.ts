import { prisma } from "./client";
import { createDefaultColumns } from "../src/lib/defaults";

async function main() {
  const seedUserId = "00000000-0000-0000-0000-000000000001";

  await prisma.task.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.calendarAuth.deleteMany();
  await prisma.projectColumn.deleteMany();
  await prisma.project.deleteMany();
  await prisma.teamMemberArea.deleteMany();
  await prisma.teamArea.deleteMany();
  await prisma.profile.deleteMany();

  await prisma.profile.create({
    data: {
      id: seedUserId,
      email: "seed@seorganizeb2b.com",
      name: "Seed User",
    },
  });

  const salesArea = await prisma.teamArea.create({
    data: {
      name: "Sales",
      color: "#3b82f6",
      createdBy: seedUserId,
    },
  });

  const engineeringArea = await prisma.teamArea.create({
    data: {
      name: "Engineering",
      color: "#10b981",
      createdBy: seedUserId,
    },
  });

  const marketingArea = await prisma.teamArea.create({
    data: {
      name: "Marketing",
      color: "#f97316",
      createdBy: seedUserId,
    },
  });

  const project1 = await prisma.project.create({
    data: {
      name: "Acme Corp Onboarding",
      description: "Client onboarding pipeline and collateral",
      areaId: salesArea.id,
      createdBy: seedUserId,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: "Q3 Product Launch",
      description: "New product release planning and execution",
      areaId: engineeringArea.id,
      createdBy: seedUserId,
    },
  });

  await createDefaultColumns(project1.id);
  await createDefaultColumns(project2.id);

  const columns1 = await prisma.projectColumn.findMany({
    where: { projectId: project1.id },
    orderBy: { position: "asc" },
  });

  const columns2 = await prisma.projectColumn.findMany({
    where: { projectId: project2.id },
    orderBy: { position: "asc" },
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Draft welcome email sequence",
        projectId: project1.id,
        columnId: columns1[0].id,
        priority: "high",
        createdBy: seedUserId,
      },
      {
        title: "Design onboarding flow",
        projectId: project1.id,
        columnId: columns1[0].id,
        priority: "medium",
        createdBy: seedUserId,
      },
      {
        title: "Set up client CRM record",
        projectId: project1.id,
        columnId: columns1[1].id,
        priority: "urgent",
        createdBy: seedUserId,
      },
      {
        title: "Finalize feature list for Q3",
        projectId: project2.id,
        columnId: columns2[0].id,
        priority: "high",
        createdBy: seedUserId,
      },
      {
        title: "Prepare beta launch checklist",
        projectId: project2.id,
        columnId: columns2[0].id,
        priority: "medium",
        createdBy: seedUserId,
      },
    ],
  });

  console.log("Seeded: 3 areas, 2 projects, 5 tasks");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
