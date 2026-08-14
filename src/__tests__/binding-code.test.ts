import { describe, expect, it } from "vitest";
import {
  hashBindingCode,
  normalizeBindingCode,
  verifyBindingCode,
} from "../lib/invites/binding-code";

describe("workspace binding code", () => {
  it("trims only outer whitespace and preserves case", () => {
    expect(normalizeBindingCode("  Abc12345  ")).toBe("Abc12345");
  });

  it("requires at least eight characters", () => {
    expect(() => normalizeBindingCode("short")).toThrow(
      "at least 8 characters",
    );
  });

  it("hashes and verifies a code without storing the plaintext", async () => {
    const code = "Acme-Join-2026";
    const encodedHash = await hashBindingCode(code);

    expect(encodedHash).not.toContain(code);
    await expect(verifyBindingCode(code, encodedHash)).resolves.toBe(true);
    await expect(verifyBindingCode("wrong-code", encodedHash)).resolves.toBe(false);
    await expect(verifyBindingCode(code.toLowerCase(), encodedHash)).resolves.toBe(false);
    await expect(verifyBindingCode(`  ${code}  `, encodedHash)).resolves.toBe(true);
  });
});
