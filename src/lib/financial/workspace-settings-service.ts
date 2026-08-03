import { FinancialValidationError } from "./lifecycle";
import { prisma } from "../../../prisma/client";

export interface WorkspaceSettingsInput {
  companyName?: string;
  logoUrl?: string;
}

export async function getWorkspaceSettings() {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { id: "default" },
  });
  if (settings) return settings;
  return prisma.workspaceSettings.create({
    data: { id: "default" },
  });
}

export async function updateWorkspaceSettings(input: WorkspaceSettingsInput) {
  const data: { companyName?: string | null; logoUrl?: string | null } = {};
  if (input.companyName !== undefined) data.companyName = input.companyName.trim() || null;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl.trim() || null;
  if (!data.companyName && data.logoUrl === undefined) {
    throw new FinancialValidationError("Nothing to update");
  }
  return prisma.workspaceSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
}
