import { prisma } from "../../../prisma/client";

export type AIModelOwnershipMode = "managed" | "byok";

export interface AIModelCatalogEntry {
  id: string;
  provider: string;
  model: string;
  ownershipMode: AIModelOwnershipMode;
  isActive: boolean;
  vision: boolean;
  streaming: boolean;
  inputCostMicros: number;
  outputCostMicros: number;
  imageCostMicros: number;
  creditCostPerCycle: number;
  maxOutputTokens: number;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

function toPublic(entry: {
  id: string;
  provider: string;
  model: string;
  ownershipMode: string;
  isActive: boolean;
  vision: boolean;
  streaming: boolean;
  inputCostMicros: number;
  outputCostMicros: number;
  imageCostMicros: number;
  creditCostPerCycle: number;
  maxOutputTokens: number;
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}): AIModelCatalogEntry | null {
  if (entry.ownershipMode !== "managed" && entry.ownershipMode !== "byok") return null;
  return {
    id: entry.id,
    provider: entry.provider,
    model: entry.model,
    ownershipMode: entry.ownershipMode,
    isActive: entry.isActive,
    vision: entry.vision,
    streaming: entry.streaming,
    inputCostMicros: entry.inputCostMicros,
    outputCostMicros: entry.outputCostMicros,
    imageCostMicros: entry.imageCostMicros,
    creditCostPerCycle: entry.creditCostPerCycle,
    maxOutputTokens: entry.maxOutputTokens,
    version: entry.version,
    effectiveFrom: entry.effectiveFrom.toISOString(),
    effectiveTo: entry.effectiveTo?.toISOString() ?? null,
  };
}

function assertValidCatalogEntry(entry: AIModelCatalogEntry): AIModelCatalogEntry {
  if (entry.ownershipMode === "managed" && entry.creditCostPerCycle <= 0) {
    throw new Error("Managed AI models must have a positive credit cost per cycle");
  }
  return entry;
}

export async function listAIModelCatalog(): Promise<AIModelCatalogEntry[]> {
  const entries = await prisma.aiModelCatalogEntry.findMany({
    orderBy: [{ provider: "asc" }, { model: "asc" }, { version: "desc" }],
  });
  return entries.map(toPublic).filter((entry): entry is AIModelCatalogEntry => entry !== null).map(assertValidCatalogEntry);
}

export async function listActiveAIModelCatalog(now = new Date()): Promise<AIModelCatalogEntry[]> {
  const entries = await prisma.aiModelCatalogEntry.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: [{ provider: "asc" }, { model: "asc" }, { version: "desc" }],
  });
  return entries.map(toPublic).filter((entry): entry is AIModelCatalogEntry => entry !== null).map(assertValidCatalogEntry);
}

export async function getActiveAIModelCatalogEntry(
  provider: string,
  model: string,
  now = new Date(),
): Promise<AIModelCatalogEntry | null> {
  const entry = await prisma.aiModelCatalogEntry.findFirst({
    where: {
      provider,
      model,
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { version: "desc" },
  });
  return entry ? assertValidCatalogEntry(toPublic(entry)!) : null;
}
