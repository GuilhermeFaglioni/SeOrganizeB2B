export interface AIStudioRandomSource {
  randomUUID?: () => string;
  getRandomValues?: (values: Uint8Array) => Uint8Array;
}

function defaultRandomSource(): AIStudioRandomSource {
  if (typeof globalThis.crypto === "undefined") return {};
  return {
    randomUUID:
      typeof globalThis.crypto.randomUUID === "function"
        ? () => globalThis.crypto.randomUUID()
        : undefined,
    getRandomValues:
      typeof globalThis.crypto.getRandomValues === "function"
        ? (values) => globalThis.crypto.getRandomValues(values)
        : undefined,
  };
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function createAIStudioId(
  source: AIStudioRandomSource = defaultRandomSource(),
): string {
  if (source.randomUUID) return source.randomUUID();

  const bytes = new Uint8Array(16);
  if (source.getRandomValues) {
    source.getRandomValues(bytes);
  } else {
    const now = Date.now();
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (now + Math.floor(Math.random() * 256) + index) & 0xff;
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}
