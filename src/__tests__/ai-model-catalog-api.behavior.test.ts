import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSuperAdminStatus: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/admin/super-admin", () => ({ getSuperAdminStatus: mocks.getSuperAdminStatus }));
vi.mock("@/lib/ai/model-catalog", () => ({ listAIModelCatalog: vi.fn() }));
vi.mock("../../prisma/client", () => ({
  prisma: { aiModelCatalogEntry: { findFirst: mocks.findFirst, create: mocks.create } },
}));

import { POST } from "../app/api/admin/ai-models/route";

describe("AI model catalog pricing input", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({ id: "admin-1" });
    mocks.getSuperAdminStatus.mockResolvedValue(true);
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "model-1" });
  });

  it("accepts Brazilian decimal commas and stores USD micros per million tokens", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/ai-models", {
      method: "POST",
      body: JSON.stringify({
        provider: "opencode",
        model: "deepseek-v4-flash",
        ownershipMode: "managed",
        inputCostPerMillion: "0,14",
        outputCostPerMillion: "0.28",
        imageCostPerMillion: "0",
        creditCostPerCycle: 1,
        maxOutputTokens: 6000,
        vision: false,
        streaming: true,
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(response?.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ inputCostMicros: 140000, outputCostMicros: 280000 }),
    }));
  });
});
