export const ACTION_PERMISSIONS = ["view", "create", "edit", "delete"] as const;

export const MODULES: Record<string, readonly string[]> = {
  tasks: ["view", "create", "edit", "delete"],
  projects: ["view", "create", "edit", "delete"],
  calendar: ["view", "create", "edit", "delete"],
  documents: ["view", "create", "edit", "delete"],
  "financial.overview": ["view"],
  "financial.contracts": ["view", "create", "edit", "delete"],
  "financial.proposals": ["view", "create", "edit", "delete"],
  "financial.clients": ["view", "create", "edit", "delete"],
  "financial.receivables": ["view", "create", "edit", "delete"],
  areas: ["view", "create", "edit", "delete"],
} as const;

export const SPECIAL_PERMISSIONS = [
  "financial.contracts.lifecycle",
  "financial.contracts.adjustValue",
  "financial.receivables.markPaid",
  "financial.receivables.refund",
  "financial.proposals.send",
  "financial.proposals.acceptReject",
  "financial.proposals.clone",
  "financial.proposals.manageTemplates",
  "manage_roles",
] as const;

export function allPermissions(): string[] {
  const modulePermissions: string[] = [];
  for (const [module, actions] of Object.entries(MODULES)) {
    for (const action of actions) {
      modulePermissions.push(`${module}.${action}`);
    }
  }
  return [...modulePermissions, ...SPECIAL_PERMISSIONS];
}

const VALID = new Set<string>(allPermissions());

export function isValidPermission(key: string): boolean {
  return VALID.has(key);
}

export function sanitizePermissions(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    if (typeof key === "string" && isValidPermission(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export function hasFinancialView(permissions: readonly string[]): boolean {
  const financialModules = Object.keys(MODULES).filter((module) =>
    module.startsWith("financial")
  );
  return financialModules.some((module) =>
    permissions.includes(`${module}.view`)
  );
}

export const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001";
