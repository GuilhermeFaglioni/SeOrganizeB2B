import { prisma, withTenantBypass } from "./client";
import { createDefaultColumns } from "../src/lib/defaults";
import { DEFAULT_WORKSPACE_ID } from "../src/lib/tenant";

async function main() {
  const seedUserId = "00000000-0000-0000-0000-000000000001";
  const adminRoleId = "00000000-0000-0000-0000-000000000001";

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

  const defaultWorkspace = await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {},
    create: {
      id: DEFAULT_WORKSPACE_ID,
      name: "Default",
      slug: "default",
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { id: adminRoleId },
    update: {},
    create: {
      id: adminRoleId,
      name: "Admin",
      permissions: [],
      isAdmin: true,
      tenantId: defaultWorkspace.id,
    },
  });

  let starterPlan = await prisma.plan.findFirst({
    where: { name: "Starter" },
  });

  if (!starterPlan) {
    starterPlan = await prisma.plan.create({
      data: {
        name: "Starter",
        allowedModules: ["tasks", "projects", "calendar", "documents"],
        isDefault: true,
        isActive: true,
      },
    });
  }

  const starterLimits = [
    { resource: "users", limit: 5, behavior: "hard" },
    { resource: "tasks", limit: 100, behavior: "warning" },
    { resource: "projects", limit: 10, behavior: "hard" },
  ];

  for (const { resource, limit, behavior } of starterLimits) {
    const existing = await prisma.planLimit.findFirst({
      where: { planId: starterPlan.id, resource },
    });

    if (!existing) {
      await prisma.planLimit.create({
        data: { planId: starterPlan.id, resource, limit, behavior },
      });
    }
  }

  await prisma.profile.create({
    data: {
      id: seedUserId,
      email: "seed@seorganizeb2b.com",
      name: "Seed User",
      tenantId: defaultWorkspace.id,
      roleId: adminRole.id,
    },
  });

  const salesArea = await prisma.teamArea.create({
    data: {
      name: "Sales",
      color: "#3b82f6",
      createdBy: seedUserId,
      tenantId: defaultWorkspace.id,
    },
  });

  const engineeringArea = await prisma.teamArea.create({
    data: {
      name: "Engineering",
      color: "#10b981",
      createdBy: seedUserId,
      tenantId: defaultWorkspace.id,
    },
  });

  const marketingArea = await prisma.teamArea.create({
    data: {
      name: "Marketing",
      color: "#f97316",
      createdBy: seedUserId,
      tenantId: defaultWorkspace.id,
    },
  });

  const project1 = await prisma.project.create({
    data: {
      name: "Acme Corp Onboarding",
      description: "Client onboarding pipeline and collateral",
      areaId: salesArea.id,
      createdBy: seedUserId,
      tenantId: defaultWorkspace.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: "Q3 Product Launch",
      description: "New product release planning and execution",
      areaId: engineeringArea.id,
      createdBy: seedUserId,
      tenantId: defaultWorkspace.id,
    },
  });

  await createDefaultColumns(project1.id, defaultWorkspace.id);
  await createDefaultColumns(project2.id, defaultWorkspace.id);

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
        tenantId: defaultWorkspace.id,
      },
      {
        title: "Design onboarding flow",
        projectId: project1.id,
        columnId: columns1[0].id,
        priority: "medium",
        createdBy: seedUserId,
        tenantId: defaultWorkspace.id,
      },
      {
        title: "Set up client CRM record",
        projectId: project1.id,
        columnId: columns1[1].id,
        priority: "urgent",
        createdBy: seedUserId,
        tenantId: defaultWorkspace.id,
      },
      {
        title: "Finalize feature list for Q3",
        projectId: project2.id,
        columnId: columns2[0].id,
        priority: "high",
        createdBy: seedUserId,
        tenantId: defaultWorkspace.id,
      },
      {
        title: "Prepare beta launch checklist",
        projectId: project2.id,
        columnId: columns2[0].id,
        priority: "medium",
        createdBy: seedUserId,
        tenantId: defaultWorkspace.id,
      },
    ],
  });

  console.log("Seeded: 3 areas, 2 projects, 5 tasks");
}

withTenantBypass(main)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
