import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = "v1";
const ENVELOPE_AAD = Buffer.from("seorganize-ai-secret-v1");
const KEY_ENV = "AI_SECRET_ENCRYPTION_KEY";

export type AiSecretCryptoErrorCode =
  | "AI_SECRET_KEY_MISSING"
  | "AI_SECRET_KEY_INVALID"
  | "AI_SECRET_INVALID";

export class AiSecretCryptoError extends Error {
  readonly code: AiSecretCryptoErrorCode;

  constructor(code: AiSecretCryptoErrorCode, message: string) {
    super(message);
    this.name = "AiSecretCryptoError";
    this.code = code;
  }
}

function encryptionKey(): Buffer {
  const encoded = process.env[KEY_ENV];
  if (!encoded) {
    throw new AiSecretCryptoError(
      "AI_SECRET_KEY_MISSING",
      `${KEY_ENV} is not configured`,
    );
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new AiSecretCryptoError(
      "AI_SECRET_KEY_INVALID",
      `${KEY_ENV} must be a base64-encoded 32-byte key`,
    );
  }
  return key;
}

export function isEncryptedAiSecret(value: string | null | undefined): boolean {
  return value?.startsWith(`${ENVELOPE_VERSION}.`) ?? false;
}

export function encryptAiSecret(value: string): string {
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

export function decryptAiSecret(value: string | null | undefined): string {
  if (!value) {
    throw new AiSecretCryptoError(
      "AI_SECRET_INVALID",
      "AI secret is missing",
    );
  }
  if (!isEncryptedAiSecret(value)) {
    throw new AiSecretCryptoError(
      "AI_SECRET_INVALID",
      "AI secret is not encrypted",
    );
  }

  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== ENVELOPE_VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new AiSecretCryptoError(
      "AI_SECRET_INVALID",
      "AI secret envelope is invalid",
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
    if (error instanceof AiSecretCryptoError) throw error;
    throw new AiSecretCryptoError(
      "AI_SECRET_INVALID",
      "AI secret could not be decrypted",
    );
  }
}
