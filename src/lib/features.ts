import { prisma, withTenant } from "../../prisma/client";
import type { PlanLimit } from "@prisma/client";

const FEATURES_TTL_MS = 30_000;
const LIMITS_TTL_MS = 30_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const featuresCache = new Map<string, CacheEntry<string[]>>();
const limitsCache = new Map<string, CacheEntry<PlanLimit[]>>();

function getCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string
): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearFeaturesCache(workspaceId: string): void {
  featuresCache.delete(workspaceId);
}

export function clearLimitsCache(workspaceId: string): void {
  limitsCache.delete(workspaceId);
}

export function clearCache(workspaceId: string): void {
  clearFeaturesCache(workspaceId);
  clearLimitsCache(workspaceId);
}

export function clearAllCaches(): void {
  featuresCache.clear();
  limitsCache.clear();
}

interface WorkspacePlanData {
  allowedModules: string[];
  planLimits: PlanLimit[];
}

async function loadPlanForWorkspace(
  workspaceId: string
): Promise<WorkspacePlanData> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      plan: {
        select: {
          allowedModules: true,
          planLimits: true,
        },
      },
    },
  });
  return {
    allowedModules: (workspace?.plan?.allowedModules as string[]) ?? [],
    planLimits: workspace?.plan?.planLimits ?? [],
  };
}

export interface WorkspaceFeatures {
  allowedModules: string[];
}

export async function getWorkspaceFeatures(
  workspaceId: string
): Promise<WorkspaceFeatures> {
  const cached = getCached(featuresCache, workspaceId);
  if (cached) return { allowedModules: cached };
  const { allowedModules } = await loadPlanForWorkspace(workspaceId);
  setCached(featuresCache, workspaceId, allowedModules, FEATURES_TTL_MS);
  return { allowedModules };
}

export async function checkFeature(
  workspaceId: string,
  module: string
): Promise<boolean> {
  const { allowedModules } = await getWorkspaceFeatures(workspaceId);
  return allowedModules.includes(module);
}

export async function getWorkspaceLimits(
  workspaceId: string
): Promise<PlanLimit[]> {
  const cached = getCached(limitsCache, workspaceId);
  if (cached) return cached;
  const { planLimits } = await loadPlanForWorkspace(workspaceId);
  setCached(limitsCache, workspaceId, planLimits, LIMITS_TTL_MS);
  return planLimits;
}

export interface CheckLimitResult {
  remaining: number;
  limit: number;
  behavior: "hard" | "warning";
}

type ResourceCounter = (tenantId: string) => Promise<number>;

const RESOURCE_COUNTERS: Record<string, ResourceCounter> = {
  users: (tenantId) =>
    withTenant(tenantId, () =>
      prisma.profile.count({ where: { tenantId } })
    ),
  tasks: (tenantId) =>
    withTenant(tenantId, () => prisma.task.count({ where: { tenantId } })),
  projects: (tenantId) =>
    withTenant(tenantId, () => prisma.project.count({ where: { tenantId } })),
  contracts: (tenantId) =>
    withTenant(tenantId, () => prisma.contract.count({ where: { tenantId } })),
  clients: (tenantId) =>
    withTenant(tenantId, () => prisma.client.count({ where: { tenantId } })),
  proposals: (tenantId) =>
    withTenant(tenantId, () => prisma.proposal.count({ where: { tenantId } })),
  documents: (tenantId) =>
    withTenant(tenantId, () => prisma.document.count({ where: { tenantId } })),
  calendarEvents: (tenantId) =>
    withTenant(tenantId, () =>
      prisma.calendarEvent.count({ where: { tenantId } })
    ),
};

export async function checkLimit(
  workspaceId: string,
  resource: string
): Promise<CheckLimitResult> {
  const limits = await getWorkspaceLimits(workspaceId);
  const planLimit = limits.find((limit) => limit.resource === resource);

  if (!planLimit) {
    return {
      remaining: Number.POSITIVE_INFINITY,
      limit: Number.POSITIVE_INFINITY,
      behavior: "hard",
    };
  }

  const counter = RESOURCE_COUNTERS[resource];
  const count = counter ? await counter(workspaceId) : 0;
  return {
    remaining: Math.max(0, planLimit.limit - count),
    limit: planLimit.limit,
    behavior: planLimit.behavior === "hard" ? "hard" : "warning",
  };
}

export interface WorkspaceUsage {
  users: number;
  tasks: number;
  projects: number;
  contracts: number;
  clients: number;
  proposals: number;
  documents: number;
  calendarEvents: number;
}

export async function countWorkspaceUsage(
  workspaceId: string
): Promise<WorkspaceUsage> {
  const [users, tasks, projects, contracts, clients, proposals, documents, calendarEvents] =
    await Promise.all([
      RESOURCE_COUNTERS.users(workspaceId),
      RESOURCE_COUNTERS.tasks(workspaceId),
      RESOURCE_COUNTERS.projects(workspaceId),
      RESOURCE_COUNTERS.contracts(workspaceId),
      RESOURCE_COUNTERS.clients(workspaceId),
      RESOURCE_COUNTERS.proposals(workspaceId),
      RESOURCE_COUNTERS.documents(workspaceId),
      RESOURCE_COUNTERS.calendarEvents(workspaceId),
    ]);
  return {
    users,
    tasks,
    projects,
    contracts,
    clients,
    proposals,
    documents,
    calendarEvents,
  };
}
