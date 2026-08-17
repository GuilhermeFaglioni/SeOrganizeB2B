import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = "v1";
const ENVELOPE_AAD = Buffer.from("seorganize-google-token-v1");
const KEY_ENV = "GOOGLE_TOKEN_ENCRYPTION_KEY";

export class GoogleTokenCryptoError extends Error {
  readonly code:
    | "GOOGLE_TOKEN_KEY_MISSING"
    | "GOOGLE_TOKEN_KEY_INVALID"
    | "GOOGLE_TOKEN_MIGRATION_REQUIRED"
    | "GOOGLE_TOKEN_INVALID";

  constructor(
    code:
      | "GOOGLE_TOKEN_KEY_MISSING"
      | "GOOGLE_TOKEN_KEY_INVALID"
      | "GOOGLE_TOKEN_MIGRATION_REQUIRED"
      | "GOOGLE_TOKEN_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "GoogleTokenCryptoError";
    this.code = code;
  }
}

function encryptionKey(): Buffer {
  const encoded = process.env[KEY_ENV];
  if (!encoded) {
    throw new GoogleTokenCryptoError(
      "GOOGLE_TOKEN_KEY_MISSING",
      `${KEY_ENV} is not configured`,
    );
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new GoogleTokenCryptoError(
      "GOOGLE_TOKEN_KEY_INVALID",
      `${KEY_ENV} must be a base64-encoded 32-byte key`,
    );
  }
  return key;
}

export function isEncryptedGoogleToken(value: string | null | undefined): boolean {
  return value?.startsWith(`${ENVELOPE_VERSION}.`) ?? false;
}

export function encryptGoogleToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(ENVELOPE_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptGoogleToken(value: string | null | undefined): string {
  if (!value) {
    throw new GoogleTokenCryptoError(
      "GOOGLE_TOKEN_INVALID",
      "Google token is missing",
    );
  }
  if (!isEncryptedGoogleToken(value)) {
    throw new GoogleTokenCryptoError(
      "GOOGLE_TOKEN_MIGRATION_REQUIRED",
      "Google token migration is required before it can be used",
    );
  }

  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== ENVELOPE_VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new GoogleTokenCryptoError(
      "GOOGLE_TOKEN_INVALID",
      "Google token envelope is invalid",
    );
  }

  try {
    const key = encryptionKey();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAAD(ENVELOPE_AAD);
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof GoogleTokenCryptoError) throw error;
    throw new GoogleTokenCryptoError(
      "GOOGLE_TOKEN_INVALID",
      "Google token could not be decrypted",
    );
  }
}
