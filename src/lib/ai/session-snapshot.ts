import { decryptAiSecret, encryptAiSecret } from "./crypto";
import { AI_STUDIO_SESSION_TTL_MS } from "./studio-contract";

const SNAPSHOT_KIND = "ai-studio-session";
const MAX_SNAPSHOT_BYTES = 64 * 1024;

export class AIStudioSessionSnapshotError extends Error {
  constructor(message = "O snapshot da sessão do AI Studio é inválido ou expirou.") {
    super(message);
    this.name = "AIStudioSessionSnapshotError";
  }
}

export interface AIStudioSessionSnapshotData {
  tenantId: string;
  actorId: string;
  sessionId: string;
  locale: string;
  directive: string | null;
  expiresAt: number;
}

export function createAIStudioSessionSnapshot(input: Omit<AIStudioSessionSnapshotData, "expiresAt">): string {
  const payload: AIStudioSessionSnapshotData & { kind: string } = {
    kind: SNAPSHOT_KIND,
    ...input,
    expiresAt: Date.now() + AI_STUDIO_SESSION_TTL_MS,
  };
  const snapshot = encryptAiSecret(JSON.stringify(payload));
  if (Buffer.byteLength(snapshot, "utf8") > MAX_SNAPSHOT_BYTES) {
    throw new AIStudioSessionSnapshotError("A diretriz da sessão excede o limite permitido.");
  }
  return snapshot;
}

export function readAIStudioSessionSnapshot(
  snapshot: string,
  expected: Pick<AIStudioSessionSnapshotData, "tenantId" | "actorId" | "sessionId">,
): AIStudioSessionSnapshotData {
  if (Buffer.byteLength(snapshot, "utf8") > MAX_SNAPSHOT_BYTES) {
    throw new AIStudioSessionSnapshotError();
  }

  try {
    const payload = JSON.parse(decryptAiSecret(snapshot)) as Partial<AIStudioSessionSnapshotData> & { kind?: string };
    if (
      payload.kind !== SNAPSHOT_KIND ||
      payload.tenantId !== expected.tenantId ||
      payload.actorId !== expected.actorId ||
      payload.sessionId !== expected.sessionId ||
      typeof payload.locale !== "string" ||
      (payload.directive !== null && typeof payload.directive !== "string") ||
      typeof payload.expiresAt !== "number" ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      throw new AIStudioSessionSnapshotError();
    }
    return payload as AIStudioSessionSnapshotData;
  } catch (error) {
    if (error instanceof AIStudioSessionSnapshotError) throw error;
    throw new AIStudioSessionSnapshotError();
  }
}
