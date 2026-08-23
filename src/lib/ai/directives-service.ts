import { FinancialValidationError } from "../financial/lifecycle";
import { prisma, withTenant } from "../../../prisma/client";
import { AI_DIRECTIVE_MAX_LENGTH } from "../constants";

export { AI_DIRECTIVE_MAX_LENGTH };

export interface DirectiveInput {
  content: string;
}

export interface WorkspaceDirectiveData {
  id: string;
  tenantId: string;
  content: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validates and normalizes directive input. Directives are plain text: only a
 * string payload is accepted, and an oversized payload is rejected instead of
 * being silently truncated.
 */
export function validateDirectiveContent(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new FinancialValidationError(
      "The workspace directive must be text"
    );
  }
  const content = raw.trim();
  if (content.length > AI_DIRECTIVE_MAX_LENGTH) {
    throw new FinancialValidationError(
      `The workspace directive is limited to ${AI_DIRECTIVE_MAX_LENGTH} characters`
    );
  }
  return content;
}

/**
 * Reads the workspace directive. Returns `null` when the workspace has no
 * directive configured — the AI Studio must then fall back to the platform
 * baseline (no-directive state).
 */
export async function getWorkspaceDirective(
  tenantId: string
): Promise<WorkspaceDirectiveData | null> {
  return withTenant(tenantId, () =>
    prisma.workspaceDirective.findUnique({
      where: { tenantId },
    })
  );
}

/**
 * Creates or replaces the single workspace directive. `updatedBy`/`updatedAt`
 * give the edit traceability; there is never more than one active directive
 * per workspace (tenant-unique).
 */
export async function upsertWorkspaceDirective(
  input: DirectiveInput,
  tenantId: string,
  actorId: string
): Promise<WorkspaceDirectiveData> {
  const content = validateDirectiveContent(input.content);
  return withTenant(tenantId, () =>
    prisma.workspaceDirective.upsert({
      where: { tenantId },
      update: { content, updatedBy: actorId },
      create: { tenantId, content, updatedBy: actorId },
    })
  );
}

/**
 * Removes the workspace directive, returning the workspace to the platform
 * baseline.
 */
export async function clearWorkspaceDirective(
  tenantId: string
): Promise<void> {
  await withTenant(tenantId, async () => {
    const existing = await prisma.workspaceDirective.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (existing) {
      await prisma.workspaceDirective.delete({ where: { id: existing.id } });
    }
  });
}
