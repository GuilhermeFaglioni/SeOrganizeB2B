import { FinancialValidationError } from "./lifecycle";
import { prisma } from "../../../prisma/client";

export interface WorkspaceSettingsInput {
  companyName?: string;
  logoUrl?: string;
  pixKey?: string;
}

/**
 * PIX key format: CPF (11 digits), CNPJ (14 digits), phone (+55XXXXXXXXXXX),
 * email, or EVP (32-hex-char UUID without dashes).
 * Accepts raw input — trims whitespace before validation.
 */
export function validatePixKey(raw: string): string {
  const key = raw.trim();
  if (!key) return "";

  // CPF: 11 digits
  if (/^\d{11}$/.test(key)) return key;
  // CNPJ: 14 digits
  if (/^\d{14}$/.test(key)) return key;
  // Phone: +55 followed by 10-11 digits
  if (/^\+55\d{10,11}$/.test(key)) return key;
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return key;
  // EVP (random key): 32 hex chars (UUID without dashes)
  if (/^[0-9a-fA-F]{32}$/.test(key)) return key;

  throw new FinancialValidationError(
    "Chave PIX inválida. Use CPF, CNPJ, telefone (+55…), e-mail ou chave aleatória (EVP)."
  );
}

/**
 * Returns the PIX key for a workspace (tenant), or empty string if not
 * configured. Never throws — safe to call from billing/invoice code.
 */
export async function getPixKey(tenantId: string): Promise<string> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: tenantId },
    select: { pixKey: true },
  });
  return workspace?.pixKey ?? "";
}

export async function getWorkspaceSettings(tenantId: string) {
  return prisma.workspace.findUnique({
    where: { id: tenantId },
  });
}

export async function updateWorkspaceSettings(
  input: WorkspaceSettingsInput,
  tenantId: string
) {
  const data: { companyName?: string | null; logoUrl?: string | null; pixKey?: string | null } = {};
  if (input.companyName !== undefined) data.companyName = input.companyName.trim() || null;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl.trim() || null;
  if (input.pixKey !== undefined) {
    const validated = validatePixKey(input.pixKey);
    data.pixKey = validated || null;
  }
  if (!data.companyName && data.logoUrl === undefined && data.pixKey === undefined) {
    throw new FinancialValidationError("Nothing to update");
  }
  return prisma.workspace.update({
    where: { id: tenantId },
    data,
  });
}
