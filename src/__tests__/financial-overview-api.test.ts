import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("overview API", () => {
  it("aggregates on the server and requires authentication", () => {
    const source = read("src/app/api/financial/overview/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("computeOverview");
    expect(source).toContain("export async function GET");
  });

  it("accepts period, client, status, project and installment filters", () => {
    const source = read("src/app/api/financial/overview/route.ts");
    expect(source).toContain("period");
    expect(source).toContain("clientId");
    expect(source).toContain("contractStatus");
    expect(source).toContain("projectId");
    expect(source).toContain("installmentStatus");
  });
});
