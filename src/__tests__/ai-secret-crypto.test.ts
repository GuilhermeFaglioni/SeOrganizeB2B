import { afterEach, describe, expect, it } from "vitest";
import {
  decryptAiSecret,
  encryptAiSecret,
  AiSecretCryptoError,
  isEncryptedAiSecret,
} from "../lib/ai/crypto";

const KEY = Buffer.alloc(32, 9).toString("base64");

describe("AI secret encryption", () => {
  afterEach(() => {
    delete process.env.AI_SECRET_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts secrets with a versioned envelope", () => {
    process.env.AI_SECRET_ENCRYPTION_KEY = KEY;

    const encrypted = encryptAiSecret("sk-secret-key");

    expect(isEncryptedAiSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain("sk-secret-key");
    expect(decryptAiSecret(encrypted)).toBe("sk-secret-key");
  });

  it("uses a different nonce for every encryption", () => {
    process.env.AI_SECRET_ENCRYPTION_KEY = KEY;

    expect(encryptAiSecret("same-key")).not.toBe(encryptAiSecret("same-key"));
  });

  it("rejects plaintext values instead of silently falling back", () => {
    process.env.AI_SECRET_ENCRYPTION_KEY = KEY;

    expect(() => decryptAiSecret("sk-plaintext")).toThrowError(
      expect.objectContaining<Partial<AiSecretCryptoError>>({
        code: "AI_SECRET_INVALID",
      }),
    );
  });

  it("fails closed when the encryption key is missing", () => {
    expect(() => encryptAiSecret("sk-key")).toThrowError(
      expect.objectContaining<Partial<AiSecretCryptoError>>({
        code: "AI_SECRET_KEY_MISSING",
      }),
    );
  });

  it("never exposes the secret inside the ciphertext envelope", () => {
    process.env.AI_SECRET_ENCRYPTION_KEY = KEY;

    const secret = "sk-abc123-secret";
    const encrypted = encryptAiSecret(secret);
    const [version, iv, tag, ciphertext] = encrypted.split(".");

    expect(version).toBe("v1");
    expect(iv).toBeTruthy();
    expect(tag).toBeTruthy();
    expect(ciphertext).toBeTruthy();
    expect(ciphertext).not.toContain(secret);
  });
});
