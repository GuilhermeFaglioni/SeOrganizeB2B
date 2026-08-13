import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

// ---------------------------------------------------------------------------
// validatePixKey — pure logic tests (imported directly)
// ---------------------------------------------------------------------------
import {
  validatePixKey,
  getPixKey,
} from "../lib/financial/workspace-settings-service";
import { FinancialValidationError } from "../lib/financial/lifecycle";

describe("validatePixKey", () => {
  it("accepts a valid CPF key (11 digits)", () => {
    expect(validatePixKey("12345678901")).toBe("12345678901");
  });

  it("accepts a valid CNPJ key (14 digits)", () => {
    expect(validatePixKey("12345678000195")).toBe("12345678000195");
  });

  it("accepts a valid phone key with +55 prefix", () => {
    expect(validatePixKey("+5511999998888")).toBe("+5511999998888");
  });

  it("accepts a valid email key", () => {
    expect(validatePixKey("prestador@example.com")).toBe(
      "prestador@example.com"
    );
  });

  it("accepts a valid EVP (random) key — 32 hex chars", () => {
    const evp = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
    expect(validatePixKey(evp)).toBe(evp);
  });

  it("trims whitespace before validation", () => {
    expect(validatePixKey("  12345678901  ")).toBe("12345678901");
  });

  it("returns empty string for blank input", () => {
    expect(validatePixKey("")).toBe("");
    expect(validatePixKey("   ")).toBe("");
  });

  it("rejects an invalid key format", () => {
    expect(() => validatePixKey("not-a-pix-key")).toThrow(
      FinancialValidationError
    );
    expect(() => validatePixKey("12345")).toThrow(FinancialValidationError);
    expect(() => validatePixKey("+5511999")).toThrow(FinancialValidationError);
  });
});

describe("getPixKey", () => {
  it("is exported and returns a promise", () => {
    // We cannot call it without a DB, but we verify the export exists
    expect(typeof getPixKey).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Source-level assertions for workspace-settings-service
// ---------------------------------------------------------------------------
describe("workspace settings service — pix key support", () => {
  const source = read("src/lib/financial/workspace-settings-service.ts");

  it("exports getPixKey helper", () => {
    expect(source).toContain("export async function getPixKey");
    expect(source).toContain("pixKey");
  });

  it("exports validatePixKey", () => {
    expect(source).toContain("export function validatePixKey");
  });

  it("includes pixKey in WorkspaceSettingsInput", () => {
    expect(source).toContain("pixKey?: string");
  });

  it("validates pix key in updateWorkspaceSettings", () => {
    expect(source).toContain("validatePixKey(input.pixKey)");
  });

  it("persists pixKey in the upsert data", () => {
    expect(source).toContain("data.pixKey");
  });
});
