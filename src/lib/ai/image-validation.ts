import sharp from "sharp";
import {
  AI_STUDIO_IMAGE_FORMATS,
  AI_STUDIO_MAX_IMAGE_DIMENSION_PX,
  AI_STUDIO_MAX_IMAGE_SIZE_BYTES,
  AI_STUDIO_MAX_IMAGES_PER_MESSAGE,
  type AIStudioImageAsset,
  type AIStudioImageFormat,
} from "./studio-contract";

const ACCEPTED_CONTENT_TYPES: Record<AIStudioImageFormat, string[]> = {
  png: ["image/png"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
};

/**
 * Validates the declared MIME content type. SVG, animated GIF, video and
 * unknown formats never reach pixel decoding.
 */
export function isAcceptedImageContentType(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return Object.values(ACCEPTED_CONTENT_TYPES).some((types) => types.includes(value.toLowerCase()));
}

function formatForContentType(value: unknown): AIStudioImageFormat | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  const entry = Object.entries(ACCEPTED_CONTENT_TYPES).find(([, types]) =>
    types.includes(normalized),
  );
  return entry ? (entry[0] as AIStudioImageFormat) : null;
}

export function sniffImageFormat(data: Buffer): AIStudioImageFormat | null {
  if (data.length < 12) return null;
  if (
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return "png";
  }
  if (
    data.length >= 16 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export interface AIStudioImageValidationResult {
  format: AIStudioImageFormat;
  width: number;
  height: number;
}

export class AIStudioImageValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AIStudioImageValidationError";
    this.code = code;
  }
}

/**
 * Rejects at most `AI_STUDIO_MAX_IMAGES_PER_MESSAGE` files whose declared
 * content type is allowed, whose bytes exceed the 5 MB limit, whose real
 * signature (magic bytes) does not match the declared format, and whose
 * decoded dimensions exceed the pixel limit.
 */
export async function validateStudioImages(files: {
  name: string;
  data: Buffer;
  contentType?: unknown;
}[]): Promise<AIStudioImageAsset[]> {
  if (!Array.isArray(files) || files.length === 0) {
    throw new AIStudioImageValidationError("EMPTY", "Anexe pelo menos uma imagem.");
  }
  if (files.length > AI_STUDIO_MAX_IMAGES_PER_MESSAGE) {
    throw new AIStudioImageValidationError(
      "TOO_MANY",
      `No máximo ${AI_STUDIO_MAX_IMAGES_PER_MESSAGE} imagens por mensagem.`,
    );
  }

  const validated: AIStudioImageAsset[] = [];
  for (const file of files) {
    const declared = formatForContentType(file.contentType);
    if (!declared) {
      throw new AIStudioImageValidationError(
        "UNSUPPORTED_FORMAT",
        "Formato de arquivo não suportado. Use PNG, JPEG ou WebP.",
      );
    }
    if (!Buffer.isBuffer(file.data) || file.data.length === 0) {
      throw new AIStudioImageValidationError("EMPTY", "O arquivo de imagem está vazio.");
    }
    if (file.data.length > AI_STUDIO_MAX_IMAGE_SIZE_BYTES) {
      throw new AIStudioImageValidationError(
        "TOO_LARGE",
        "A imagem excede o limite de 5 MB por arquivo.",
      );
    }

    const sniffed = sniffImageFormat(file.data);
    if (sniffed !== declared) {
      throw new AIStudioImageValidationError(
        "MISMATCHED_FORMAT",
        "O conteúdo do arquivo não corresponde ao formato informado.",
      );
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(file.data).metadata();
    } catch {
      throw new AIStudioImageValidationError(
        "UNSUPPORTED_FORMAT",
        "O arquivo não pôde ser decodificado como imagem.",
      );
    }
    if (metadata.format !== declared) {
      throw new AIStudioImageValidationError(
        "MISMATCHED_FORMAT",
        "O conteúdo do arquivo não corresponde ao formato informado.",
      );
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (
      width <= 0 ||
      height <= 0 ||
      width > AI_STUDIO_MAX_IMAGE_DIMENSION_PX ||
      height > AI_STUDIO_MAX_IMAGE_DIMENSION_PX
    ) {
      throw new AIStudioImageValidationError(
        "INVALID_DIMENSIONS",
        "A imagem excede as dimensões máximas permitidas.",
      );
    }

    validated.push({
      id: "",
      fileName: typeof file.name === "string" ? file.name.slice(0, 120) : "image",
      format: declared,
      width,
      height,
      sizeBytes: file.data.length,
      data: file.data,
    });
  }

  return validated;
}

export function formatImageKind(format: AIStudioImageFormat): string {
  return format === "jpeg" ? "JPEG" : format.toUpperCase();
}

export const AI_STUDIO_IMAGE_FORMATS_LABEL = AI_STUDIO_IMAGE_FORMATS.map((format) =>
  format === "jpeg" ? "JPEG" : format.toUpperCase(),
).join(", ");
