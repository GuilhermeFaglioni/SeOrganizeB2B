import { FinancialValidationError } from "./lifecycle";
import { prisma } from "../../../prisma/client";
import { DEFAULT_WORKSPACE_ID } from "../tenant";

export interface WorkspaceSettingsInput {
  companyName?: string;
  logoUrl?: string;
}

export async function getWorkspaceSettings() {
  const workspace = await prisma.workspace.findUnique({
    where: { id: DEFAULT_WORKSPACE_ID },
  });
  if (workspace) return workspace;
  return prisma.workspace.create({
    data: { id: DEFAULT_WORKSPACE_ID, name: "Default", slug: "default" },
  });
}

export async function updateWorkspaceSettings(input: WorkspaceSettingsInput) {
  const data: { companyName?: string | null; logoUrl?: string | null } = {};
  if (input.companyName !== undefined) data.companyName = input.companyName.trim() || null;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl.trim() || null;
  if (!data.companyName && data.logoUrl === undefined) {
    throw new FinancialValidationError("Nothing to update");
  }
  return prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: data,
    create: {
      id: DEFAULT_WORKSPACE_ID,
      name: "Default",
      slug: "default",
      ...data,
    },
  });
}
