import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("financial hooks", () => {
  it("shares a query-string and fetchJson helper", () => {
    const source = read("src/lib/financial/http.ts");
    expect(source).toContain("export function qs");
    expect(source).toContain("export async function fetchJson");
    expect(source).toContain("json.error");
  });

  it("encodes server-side filters into query keys", () => {
    const source = read("src/hooks/use-contracts.ts");
    expect(source).toContain('queryKey: ["contracts", filters]');
    expect(source).toContain("search");
    expect(source).toContain("pageSize");
  });

  it("invalidates contracts and overview after mutations", () => {
    const source = read("src/hooks/use-contracts.ts");
    expect(source).toContain('invalidateQueries({ queryKey: ["contracts"');
    expect(source).toContain('invalidateQueries({ queryKey: ["overview"');
  });

  it("builds overview queries with global filters", () => {
    const source = read("src/hooks/use-overview.ts");
    expect(source).toContain('queryKey: ["overview", filters]');
    expect(source).toContain("period");
    expect(source).toContain("clientId");
  });

  it("downloads filtered CSV exports as blobs", () => {
    const source = read("src/hooks/use-financial-exports.ts");
    expect(source).toContain("blob()");
    expect(source).toContain("createObjectURL");
    expect(source).toContain("a.download");
  });

  it("useContractChange invalidates contracts, overview, and receivables", () => {
    const source = read("src/hooks/use-contracts.ts");
    const fnStart = source.indexOf("export function useContractChange()");
    const fnEnd = source.indexOf("\n}\n", fnStart) + 3;
    const fnBody = source.slice(fnStart, fnEnd);
    expect(fnBody).toContain('invalidateQueries({ queryKey: ["contracts"');
    expect(fnBody).toContain('invalidateQueries({ queryKey: ["overview"');
    expect(fnBody).toContain('invalidateQueries({ queryKey: ["receivables"');
  });
});
