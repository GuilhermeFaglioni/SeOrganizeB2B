import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pruneAllAIStudioUsageEvents: vi.fn(),
}));

vi.mock("@/lib/ai/studio-service", () => ({
  pruneAllAIStudioUsageEvents: mocks.pruneAllAIStudioUsageEvents,
}));

import { GET } from "../app/api/cron/ai-studio-retention/route";

describe("GET /api/cron/ai-studio-retention", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mocks.pruneAllAIStudioUsageEvents.mockResolvedValue(2);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("rejects requests without the cron secret", async () => {
    const response = await GET(new Request("http://localhost/api/cron/ai-studio-retention"));

    expect(response.status).toBe(401);
    expect(mocks.pruneAllAIStudioUsageEvents).not.toHaveBeenCalled();
  });

  it("runs retention for every workspace behind the cron secret", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/ai-studio-retention", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { workspaceCount: 2 },
      error: null,
    });
    expect(mocks.pruneAllAIStudioUsageEvents).toHaveBeenCalledOnce();
  });
});
