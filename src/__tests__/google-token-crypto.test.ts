import { afterEach, describe, expect, it } from "vitest";
import {
  decryptGoogleToken,
  encryptGoogleToken,
  GoogleTokenCryptoError,
  isEncryptedGoogleToken,
} from "../lib/google/token-crypto";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("Google token encryption", () => {
  afterEach(() => {
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts tokens with a versioned envelope", () => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = KEY;

    const encrypted = encryptGoogleToken("refresh-token");

    expect(isEncryptedGoogleToken(encrypted)).toBe(true);
    expect(encrypted).not.toContain("refresh-token");
    expect(decryptGoogleToken(encrypted)).toBe("refresh-token");
  });

  it("uses a different nonce for every encryption", () => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = KEY;

    expect(encryptGoogleToken("same-token")).not.toBe(
      encryptGoogleToken("same-token"),
    );
  });

  it("rejects plaintext values instead of silently falling back", () => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = KEY;

    expect(() => decryptGoogleToken("legacy-plaintext-token")).toThrowError(
      expect.objectContaining<Partial<GoogleTokenCryptoError>>({
        code: "GOOGLE_TOKEN_MIGRATION_REQUIRED",
      }),
    );
  });

  it("fails closed when the encryption key is missing", () => {
    expect(() => encryptGoogleToken("token")).toThrowError(
      expect.objectContaining<Partial<GoogleTokenCryptoError>>({
        code: "GOOGLE_TOKEN_KEY_MISSING",
      }),
    );
  });
});
