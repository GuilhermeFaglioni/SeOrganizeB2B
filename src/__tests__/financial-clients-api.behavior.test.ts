import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    client: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../prisma/client", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.c" }),
}));

import { GET as listClients } from "../app/api/clients/route";
import {
  GET as getClient,
  PATCH as patchClient,
} from "../app/api/clients/[id]/route";

const makeRequest = (url: string, body?: unknown) =>
  new NextRequest(url, {
    method: body !== undefined ? "POST" : "GET",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

describe("clients API route behavior", () => {
  beforeEach(() => {
    mockPrisma.client.findMany.mockReset();
    mockPrisma.client.count.mockReset();
    mockPrisma.client.create.mockReset();
    mockPrisma.client.findUnique.mockReset();
    mockPrisma.client.update.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for an empty PATCH name without calling update", async () => {
    const res = await patchClient(makeRequest("http://x/api/clients/c1", { name: "   " }), {
      params: { id: "c1" },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-string PATCH name without calling update", async () => {
    const res = await patchClient(makeRequest("http://x/api/clients/c1", { name: 42 }), {
      params: { id: "c1" },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it("trims a valid PATCH name and updates", async () => {
    mockPrisma.client.update.mockResolvedValue({
      id: "c1",
      name: "Acme",
      active: true,
    });
    const res = await patchClient(makeRequest("http://x/api/clients/c1", { name: "  Acme  " }), {
      params: { id: "c1" },
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.client.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ name: "Acme" }),
    });
  });

  it("defaults invalid pagination to page 1 and pageSize 25", async () => {
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.client.count.mockResolvedValue(0);

    const res = await listClients(makeRequest("http://x/api/clients?page=abc&pageSize=xyz"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.page).toBe(1);
    expect(json.data.pageSize).toBe(25);
    expect(json.data.totalPages).toBe(1);

    const findManyArgs = mockPrisma.client.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(0);
    expect(findManyArgs.take).toBe(25);
  });

  it("clamps pageSize above the max to 50", async () => {
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.client.count.mockResolvedValue(0);

    const res = await listClients(makeRequest("http://x/api/clients?page=1&pageSize=999"));
    const json = await res.json();
    expect(json.data.pageSize).toBe(50);
  });

  it("requires authentication on list", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await listClients(makeRequest("http://x/api/clients"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when a client is not found", async () => {
    mockPrisma.client.findUnique.mockResolvedValue(null);
    const res = await getClient(makeRequest("http://x/api/clients/missing"), {
      params: { id: "missing" },
    });
    expect(res.status).toBe(404);
  });
});
