import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const DERIVED_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1 };
export const MIN_BINDING_CODE_LENGTH = 8;
const MAX_BINDING_CODE_LENGTH = 256;

export class BindingCodeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindingCodeValidationError";
  }
}

export function normalizeBindingCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new BindingCodeValidationError("Binding code must be a string");
  }

  const code = value.trim();
  if (code.length < MIN_BINDING_CODE_LENGTH) {
    throw new BindingCodeValidationError(
      `Binding code must contain at least ${MIN_BINDING_CODE_LENGTH} characters`,
    );
  }
  if (code.length > MAX_BINDING_CODE_LENGTH) {
    throw new BindingCodeValidationError(
      `Binding code must contain at most ${MAX_BINDING_CODE_LENGTH} characters`,
    );
  }
  return code;
}

function deriveKey(code: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(code, salt, DERIVED_KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

export async function hashBindingCode(value: string): Promise<string> {
  const code = normalizeBindingCode(value);
  const salt = randomBytes(16);
  const key = await deriveKey(code, salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyBindingCode(
  value: string,
  encodedHash: string,
): Promise<boolean> {
  let code: string;
  try {
    code = normalizeBindingCode(value);
  } catch {
    return false;
  }

  const [algorithm, encodedSalt, encodedKey] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedKey) return false;

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedKey = Buffer.from(encodedKey, "base64url");
    const actualKey = await deriveKey(code, salt);
    return (
      expectedKey.length === actualKey.length &&
      timingSafeEqual(expectedKey, actualKey)
    );
  } catch {
    return false;
  }
}
