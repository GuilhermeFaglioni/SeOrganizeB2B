import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const clientSource = readFileSync(resolve(__dirname, "../client.ts"), "utf8");

describe("Prisma runtime client configuration", () => {
  it("passes only the runtime datasource URL to PrismaClient", () => {
    expect(clientSource).toContain("url: getDatabaseUrl()");
    expect(clientSource).not.toContain("directUrl");
  });

  it("keeps the PgBouncer connection controls on the runtime URL", () => {
    expect(clientSource).toContain("pgbouncer=true");
    expect(clientSource).toContain("connection_limit=1");
    expect(clientSource).toContain("pool_timeout=10");
  });
});
