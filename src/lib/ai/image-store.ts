import { randomUUID } from "node:crypto";
import {
  AI_STUDIO_IMAGE_STORAGE_LIMIT_BYTES,
  AI_STUDIO_IMAGE_TTL_MS,
  AI_STUDIO_MAX_IMAGES_PER_MESSAGE,
  type AIStudioImageAsset,
  type AIStudioImageReference,
} from "./studio-contract";

/**
 * In-memory, process-local holder for uploaded reference image metadata and a
 * same-process fallback. Generation submits the browser-held File bytes
 * directly, so correctness never depends on this map surviving a serverless
 * invocation boundary. Images are never written to the database, transcripts,
 * usage events or logs and disappear on TTL sweep, explicit cleanup, or process
 * restart. Keys are scoped to a single tenant+actor so one workspace member
 * can never address another workspace's image bytes.
 */

interface StoredImage extends AIStudioImageAsset {
  storedAt: number;
}

interface ImageSlot {
  key: string;
  images: Map<string, StoredImage>;
  bytes: number;
}

const slots = new Map<string, ImageSlot>();
let lastSweepAt = Date.now();

function sweepExpired(now: number): void {
  for (const [key, slot] of slots) {
    for (const [id, image] of slot.images) {
      if (now - image.storedAt > AI_STUDIO_IMAGE_TTL_MS) {
        slot.images.delete(id);
        slot.bytes -= image.sizeBytes;
      }
    }
    if (slot.images.size === 0) {
      slots.delete(key);
    }
  }
}

function sweepIfDue(now: number): void {
  if (now - lastSweepAt > AI_STUDIO_IMAGE_TTL_MS) {
    sweepExpired(now);
    lastSweepAt = now;
  }
}

function slotFor(key: string): ImageSlot {
  const now = Date.now();
  sweepIfDue(now);
  const existing = slots.get(key);
  if (existing) return existing;
  const created: ImageSlot = { key, images: new Map(), bytes: 0 };
  slots.set(key, created);
  return created;
}

export function storeStudioImage(
  tenantId: string,
  actorId: string,
  input: AIStudioImageAsset,
): AIStudioImageReference {
  const key = `${tenantId}:${actorId}`;
  const slot = slotFor(key);
  const id = input.id || randomUUID();
  slot.images.set(id, { ...input, id, storedAt: Date.now() });
  slot.bytes += input.sizeBytes;
  if (slot.bytes > AI_STUDIO_IMAGE_STORAGE_LIMIT_BYTES) {
    const references = readStudioImageReferences(tenantId, actorId);
    let index = 0;
    while (slot.bytes > AI_STUDIO_IMAGE_STORAGE_LIMIT_BYTES && index < references.length) {
      const oldest = references[index];
      if (oldest) releaseStudioImage(tenantId, actorId, oldest.id);
      index += 1;
    }
  }
  return {
    id,
    fileName: input.fileName,
    format: input.format,
    width: input.width,
    height: input.height,
    sizeBytes: input.sizeBytes,
  };
}

export function releaseStudioImage(
  tenantId: string,
  actorId: string,
  imageId: string,
): void {
  const slot = slots.get(`${tenantId}:${actorId}`);
  const image = slot?.images.get(imageId);
  if (!image || !slot) return;
  slot.images.delete(imageId);
  slot.bytes -= image.sizeBytes;
  if (slot.images.size === 0) {
    slots.delete(slot.key);
  }
}

export function releaseStudioMessageImages(
  tenantId: string,
  actorId: string,
  imageIds: string[],
): void {
  for (const imageId of imageIds) {
    releaseStudioImage(tenantId, actorId, imageId);
  }
}

export function clearStudioImages(tenantId: string, actorId: string): void {
  slots.delete(`${tenantId}:${actorId}`);
}

export function readStudioImageReferences(
  tenantId: string,
  actorId: string,
): AIStudioImageReference[] {
  sweepIfDue(Date.now());
  const slot = slots.get(`${tenantId}:${actorId}`);
  if (!slot) return [];
  return Array.from(slot.images.values())
    .sort((a, b) => a.storedAt - b.storedAt)
    .map(({ id, fileName, format, width, height, sizeBytes }) => ({
      id,
      fileName,
      format,
      width,
      height,
      sizeBytes,
    }));
}

export function readStudioImageBytes(
  tenantId: string,
  actorId: string,
  imageIds: string[],
): AIStudioImageAsset[] {
  sweepIfDue(Date.now());
  const slot = slots.get(`${tenantId}:${actorId}`);
  if (!slot || imageIds.length === 0) return [];
  const unique = Array.from(new Set(imageIds)).slice(0, AI_STUDIO_MAX_IMAGES_PER_MESSAGE);
  return unique.flatMap((id) => {
    const image = slot.images.get(id);
    return image
      ? [
          {
            id: image.id,
            fileName: image.fileName,
            format: image.format,
            width: image.width,
            height: image.height,
            sizeBytes: image.sizeBytes,
            data: image.data,
          },
        ]
      : [];
  });
}

export function studioImageStats(): {
  slots: number;
  images: number;
  bytes: number;
} {
  let images = 0;
  let bytes = 0;
  for (const slot of slots.values()) {
    images += slot.images.size;
    bytes += slot.bytes;
  }
  return { slots: slots.size, images, bytes };
}

export function clearAllStudioImages(): void {
  slots.clear();
}
