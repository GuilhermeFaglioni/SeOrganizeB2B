import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const metadataMock = vi.fn();
vi.mock("sharp", () => ({
  default: (buffer: Buffer) => ({ metadata: () => metadataMock(buffer) }),
}));

import {
  AI_STUDIO_IMAGE_FORMATS_LABEL,
  AIStudioImageValidationError,
  formatImageKind,
  isAcceptedImageContentType,
  sniffImageFormat,
  validateStudioImages,
} from "../lib/ai/image-validation";
import {
  AI_STUDIO_IMAGE_STORAGE_LIMIT_BYTES,
  AI_STUDIO_IMAGE_TTL_MS,
  AI_STUDIO_MAX_IMAGE_SIZE_BYTES,
  AI_STUDIO_MAX_IMAGES_PER_MESSAGE,
  type AIStudioImageAsset,
} from "../lib/ai/studio-contract";
import {
  clearAllStudioImages,
  clearStudioImages,
  readStudioImageBytes,
  readStudioImageReferences,
  releaseStudioImage,
  releaseStudioMessageImages,
  storeStudioImage,
  studioImageStats,
} from "../lib/ai/image-store";

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0, 0, 0, 0]);
const WEBP_BYTES = Buffer.from("RIFFxxxxWEBPxxxxxxxxxxxxxxxx", "ascii");

function validPng(): {
  name: string;
  data: Buffer;
  contentType: string;
} {
  return {
    name: "referencia.png",
    data: PNG_BYTES,
    contentType: "image/png",
  };
}

function metadataForBuffer(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { format: "jpeg", width: 800, height: 600 };
  }
  if (buffer.length >= 4 && buffer[0] === 0x52 && buffer[1] === 0x49) {
    return { format: "webp", width: 800, height: 600 };
  }
  return { format: "png", width: 800, height: 600 };
}

describe("AI Studio image content type guard", () => {
  it("accepts only the declared PNG, JPEG and WebP content types", () => {
    expect(isAcceptedImageContentType("image/png")).toBe(true);
    expect(isAcceptedImageContentType("image/jpeg")).toBe(true);
    expect(isAcceptedImageContentType("image/webp")).toBe(true);
    expect(isAcceptedImageContentType("IMAGE/PNG")).toBe(true);
  });

  it("rejects SVG, GIF, video, unknown and non-string values", () => {
    expect(isAcceptedImageContentType("image/svg+xml")).toBe(false);
    expect(isAcceptedImageContentType("image/gif")).toBe(false);
    expect(isAcceptedImageContentType("video/mp4")).toBe(false);
    expect(isAcceptedImageContentType("application/octet-stream")).toBe(false);
    expect(isAcceptedImageContentType("")).toBe(false);
    expect(isAcceptedImageContentType(null)).toBe(false);
    expect(isAcceptedImageContentType(42)).toBe(false);
  });
});

describe("AI Studio image signature sniffing", () => {
  it("recognizes PNG, JPEG and WebP magic bytes", () => {
    expect(sniffImageFormat(PNG_BYTES)).toBe("png");
    expect(sniffImageFormat(JPEG_BYTES)).toBe("jpeg");
    expect(sniffImageFormat(WEBP_BYTES)).toBe("webp");
  });

  it("rejects SVG text, animated GIF frames and truncated payloads", () => {
    expect(sniffImageFormat(Buffer.from("<svg xmlns=..."))).toBeNull();
    expect(sniffImageFormat(Buffer.from("GIF89a..."))).toBeNull();
    expect(sniffImageFormat(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(sniffImageFormat(Buffer.alloc(0))).toBeNull();
  });
});

describe("AI Studio image validation", () => {
  beforeEach(() => {
    metadataMock.mockReset();
    metadataMock.mockResolvedValue({ format: "png", width: 800, height: 600 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns validated assets with dimensions for accepted files", async () => {
    metadataMock.mockImplementation(metadataForBuffer);
    const assets = await validateStudioImages([
      { name: "a.png", data: PNG_BYTES, contentType: "image/png" },
      { name: "b.jpg", data: JPEG_BYTES, contentType: "image/jpeg" },
      { name: "c.webp", data: WEBP_BYTES, contentType: "image/webp" },
    ]);
    expect(assets).toHaveLength(3);
    expect(assets[0]).toMatchObject({ format: "png", width: 800, height: 600, sizeBytes: PNG_BYTES.length });
    expect(assets[1]).toMatchObject({ format: "jpeg" });
    expect(assets[2]).toMatchObject({ format: "webp" });
    expect(assets[0].data).toEqual(PNG_BYTES);
  });

  it("rejects an empty selection", async () => {
    await expect(validateStudioImages([])).rejects.toMatchObject({ code: "EMPTY" });
  });

  it("rejects more than three images per message", async () => {
    const files = Array.from({ length: AI_STUDIO_MAX_IMAGES_PER_MESSAGE + 1 }, () => validPng());
    await expect(validateStudioImages(files)).rejects.toMatchObject({ code: "TOO_MANY" });
  });

  it("rejects SVG, animated GIF and video content types before decoding", async () => {
    for (const contentType of ["image/svg+xml", "image/gif", "video/mp4", "text/html"]) {
      await expect(
        validateStudioImages([{ name: "x", data: PNG_BYTES, contentType }]),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    }
  });

  it("rejects an empty file payload", async () => {
    await expect(
      validateStudioImages([{ name: "x.png", data: Buffer.alloc(0), contentType: "image/png" }]),
    ).rejects.toMatchObject({ code: "EMPTY" });
  });

  it("rejects a file larger than 5 MB", async () => {
    const oversized = Buffer.concat([PNG_BYTES, Buffer.alloc(AI_STUDIO_MAX_IMAGE_SIZE_BYTES + 1)]);
    await expect(
      validateStudioImages([{ name: "big.png", data: oversized, contentType: "image/png" }]),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("rejects tampered payloads whose signature does not match the declared format", async () => {
    await expect(
      validateStudioImages([{ name: "fake.png", data: JPEG_BYTES, contentType: "image/png" }]),
    ).rejects.toMatchObject({ code: "MISMATCHED_FORMAT" });
  });

  it("rejects a payload that sharp cannot decode as the declared format", async () => {
    metadataMock.mockResolvedValue({ format: "jpeg", width: 10, height: 10 });
    await expect(
      validateStudioImages([{ name: "real.png", data: PNG_BYTES, contentType: "image/png" }]),
    ).rejects.toMatchObject({ code: "MISMATCHED_FORMAT" });
  });

  it("rejects an undecodable payload as unsupported", async () => {
    metadataMock.mockRejectedValue(new Error("decode failed"));
    await expect(
      validateStudioImages([{ name: "broken.png", data: PNG_BYTES, contentType: "image/png" }]),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("rejects images whose decoded dimensions exceed the pixel limit", async () => {
    metadataMock.mockResolvedValue({ format: "png", width: 20_000, height: 100 });
    await expect(
      validateStudioImages([{ name: "wide.png", data: PNG_BYTES, contentType: "image/png" }]),
    ).rejects.toMatchObject({ code: "INVALID_DIMENSIONS" });
  });

  it("exposes a localized label and kind for the allowed formats", () => {
    expect(AI_STUDIO_IMAGE_FORMATS_LABEL).toBe("PNG, JPEG, WEBP");
    expect(formatImageKind("jpeg")).toBe("JPEG");
    expect(formatImageKind("webp")).toBe("WEBP");
    expect(AIStudioImageValidationError).toBeDefined();
  });
});

describe("AI Studio image store", () => {
  const asset = (id: string, sizeBytes = 64): AIStudioImageAsset => ({
    id,
    fileName: `${id}.png`,
    format: "png",
    width: 100,
    height: 100,
    sizeBytes,
    data: Buffer.alloc(sizeBytes, 1),
  });

  beforeEach(() => {
    clearAllStudioImages();
  });

  it("stores and reads back the image bytes scoped to tenant and actor", () => {
    const reference = storeStudioImage("tenant-1", "user-1", asset("img-a"));
    expect(reference.id).toBeTruthy();
    expect(readStudioImageReferences("tenant-1", "user-1").map((r) => r.id)).toEqual([reference.id]);

    const bytes = readStudioImageBytes("tenant-1", "user-1", [reference.id]);
    expect(bytes).toHaveLength(1);
    expect(bytes[0].data).toHaveLength(64);
    expect(bytes[0].id).toBe(reference.id);
  });

  it("preserves a validated client upload id so interrupted responses remain cancellable", () => {
    const reference = storeStudioImage("tenant-1", "user-1", asset("upload-id-1"));
    expect(reference.id).toBe("upload-id-1");
  });

  it("never leaks one tenant or actor's images to another", () => {
    const reference = storeStudioImage("tenant-1", "user-1", asset("img-a"));
    expect(readStudioImageReferences("tenant-2", "user-1")).toEqual([]);
    expect(readStudioImageReferences("tenant-1", "user-2")).toEqual([]);
    expect(readStudioImageBytes("tenant-2", "user-1", [reference.id])).toEqual([]);
    expect(readStudioImageBytes("tenant-1", "user-2", [reference.id])).toEqual([]);
  });

  it("releases single images, message batches and whole slots", () => {
    const a = storeStudioImage("tenant-1", "user-1", asset("a"));
    const b = storeStudioImage("tenant-1", "user-1", asset("b"));
    const c = storeStudioImage("tenant-1", "user-1", asset("c"));

    releaseStudioImage("tenant-1", "user-1", a.id);
    expect(readStudioImageReferences("tenant-1", "user-1")).toHaveLength(2);

    releaseStudioMessageImages("tenant-1", "user-1", [b.id, c.id]);
    expect(readStudioImageReferences("tenant-1", "user-1")).toEqual([]);

    storeStudioImage("tenant-1", "user-1", asset("d"));
    clearStudioImages("tenant-1", "user-1");
    expect(studioImageStats()).toMatchObject({ slots: 0, images: 0, bytes: 0 });
  });

  it("expires stored images after the TTL sweep", () => {
    vi.useFakeTimers();
    const baseline = new Date(Date.now() + AI_STUDIO_IMAGE_TTL_MS + 10_000);
    vi.setSystemTime(baseline);
    const reference = storeStudioImage("tenant-1", "user-1", asset("img-a"));

    vi.setSystemTime(new Date(baseline.getTime() + AI_STUDIO_IMAGE_TTL_MS + 1_000));
    storeStudioImage("tenant-1", "user-1", asset("img-b"));

    const remaining = readStudioImageReferences("tenant-1", "user-1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).not.toBe(reference.id);
  });

  it("sweeps expired images on read paths even without a new store", () => {
    vi.useFakeTimers();
    const baseline = new Date(Date.now() + AI_STUDIO_IMAGE_TTL_MS + 10_000);
    vi.setSystemTime(baseline);
    const reference = storeStudioImage("tenant-1", "user-1", asset("img-a"));

    vi.setSystemTime(new Date(baseline.getTime() + AI_STUDIO_IMAGE_TTL_MS + 1_000));
    expect(readStudioImageReferences("tenant-1", "user-1")).toEqual([]);
    expect(readStudioImageBytes("tenant-1", "user-1", [reference.id])).toEqual([]);
  });

  it("evicts the oldest images when the per-slot storage budget is exceeded", () => {
    const fiveMb = 5 * 1024 * 1024;
    const stored: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      stored.push(storeStudioImage("tenant-1", "user-1", asset(`img-${index}`, fiveMb)).id);
    }
    const references = readStudioImageReferences("tenant-1", "user-1");
    expect(references.length).toBeLessThan(5);
    const bytes = references.reduce((total, r) => total + r.sizeBytes, 0);
    expect(bytes).toBeLessThanOrEqual(AI_STUDIO_IMAGE_STORAGE_LIMIT_BYTES);
    expect(references.map((r) => r.id)).not.toContain(stored[0]);
  });
});
