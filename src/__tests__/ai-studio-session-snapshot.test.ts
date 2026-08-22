import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAIStudioSessionSnapshot,
  readAIStudioSessionSnapshot,
} from "../lib/ai/session-snapshot";

describe("AI Studio session snapshot", () => {
  const originalKey = process.env.AI_SECRET_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.AI_SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalKey === undefined) delete process.env.AI_SECRET_ENCRYPTION_KEY;
    else process.env.AI_SECRET_ENCRYPTION_KEY = originalKey;
  });

  it("encrypts only the tenant-scoped directive snapshot and validates its boundary", () => {
    const snapshot = createAIStudioSessionSnapshot({
      tenantId: "tenant-1",
      actorId: "actor-1",
      sessionId: "session-1",
      locale: "pt-BR",
      directive: "Tom executivo.",
    });

    expect(snapshot).not.toContain("Tom executivo");
    expect(readAIStudioSessionSnapshot(snapshot, {
      tenantId: "tenant-1",
      actorId: "actor-1",
      sessionId: "session-1",
    })).toMatchObject({ locale: "pt-BR", directive: "Tom executivo." });
    expect(() => readAIStudioSessionSnapshot(snapshot, {
      tenantId: "tenant-2",
      actorId: "actor-1",
      sessionId: "session-1",
    })).toThrow("inválido ou expirou");
    expect(() => readAIStudioSessionSnapshot(snapshot, {
      tenantId: "tenant-1",
      actorId: "actor-2",
      sessionId: "session-1",
    })).toThrow("inválido ou expirou");
    expect(() => readAIStudioSessionSnapshot(snapshot, {
      tenantId: "tenant-1",
      actorId: "actor-1",
      sessionId: "session-2",
    })).toThrow("inválido ou expirou");
  });

  it("expires without retaining a server-side session record", () => {
    vi.useFakeTimers();
    const snapshot = createAIStudioSessionSnapshot({
      tenantId: "tenant-1",
      actorId: "actor-1",
      sessionId: "session-1",
      locale: "en",
      directive: null,
    });
    vi.advanceTimersByTime(30 * 60 * 1_000 + 1);
    expect(() => readAIStudioSessionSnapshot(snapshot, {
      tenantId: "tenant-1",
      actorId: "actor-1",
      sessionId: "session-1",
    })).toThrow("inválido ou expirou");
  });
});
