import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { AIStudioError, generateTemplateCandidate } from "@/lib/ai/studio-service";
import {
  mapAIStudioError,
  readMultipartFormData,
  readJsonBody,
  requireAIStudioAccess,
  unauthorizedResponse,
} from "@/lib/ai/studio-http";
import { AI_STUDIO_MAX_GENERATION_REQUEST_BYTES } from "@/lib/ai/studio-contract";

export const maxDuration = 90;

function newlineJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function parseMultipartJsonField(form: FormData, name: string): unknown {
  const value = form.get(name);
  if (value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new AIStudioError("VALIDATION_ERROR", `O campo ${name} é inválido.`);
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new AIStudioError("VALIDATION_ERROR", `O campo ${name} é inválido.`);
  }
}

async function readGenerationBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return readJsonBody(request);
  }

  const form = await readMultipartFormData(request, AI_STUDIO_MAX_GENERATION_REQUEST_BYTES);
  const body: Record<string, unknown> = {};
  for (const name of [
    "provider",
    "model",
    "message",
    "locale",
    "sessionId",
    "sessionSnapshot",
    "consentVersion",
    "baseHtml",
  ]) {
    const value = form.get(name);
    if (typeof value === "string") body[name] = value;
  }
  body.imageIds = parseMultipartJsonField(form, "imageIds");
  body.recentMessages = parseMultipartJsonField(form, "recentMessages");
  body.sessionSummary = parseMultipartJsonField(form, "sessionSummary");
  body.stream = form.get("stream") === "true";
  body.imageFiles = await Promise.all(
    form
      .getAll("imageFiles")
      .filter(
        (value): value is File =>
          typeof value !== "string" && typeof value.arrayBuffer === "function",
      )
      .map(async (file) => ({
        name: file.name,
        data: Buffer.from(await file.arrayBuffer()),
        contentType: file.type,
      })),
  );
  return body;
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  let body: Awaited<ReturnType<typeof readJsonBody>>;
  try {
    body = await readGenerationBody(request);
  } catch (error) {
    return mapAIStudioError(error);
  }
  if (!body) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Corpo da requisição inválido." } },
      { status: 400 },
    );
  }

  if (body.stream === true) {
    const encoder = new TextEncoder();
    // Keep pre-provider failures as normal HTTP responses before committing stream headers.
    type InitialResult = { kind: "ready" } | { kind: "error"; response: Response };
    let resolveInitial!: (result: InitialResult) => void;
    let initialSettled = false;
    const initialResult = new Promise<InitialResult>((resolve) => {
      resolveInitial = (result) => {
        if (initialSettled) return;
        initialSettled = true;
        resolve(result);
      };
    });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          try {
            const result = await generateTemplateCandidate(
              {
                tenantId: access.tenantId,
                actorId: user.id,
                provider: body.provider,
                model: body.model,
                message: body.message,
                locale: body.locale,
                sessionId: body.sessionId,
                sessionSnapshot: body.sessionSnapshot,
                recentMessages: body.recentMessages,
                sessionSummary: body.sessionSummary,
                consentVersion: body.consentVersion,
                baseHtml: body.baseHtml,
                imageIds: body.imageIds,
                imageFiles: body.imageFiles,
                stream: true,
              },
              {
                onPartial: (text) => {
                  resolveInitial({ kind: "ready" });
                  controller.enqueue(encoder.encode(newlineJson({ type: "delta", text })));
                },
              },
            );
            controller.enqueue(encoder.encode(newlineJson({ type: "complete", data: result })));
            resolveInitial({ kind: "ready" });
          } catch (error) {
            const response = mapAIStudioError(error);
            if (!initialSettled) {
              resolveInitial({ kind: "error", response });
            } else {
              const payload = await response.json();
              controller.enqueue(encoder.encode(newlineJson({ type: "error", ...payload })));
            }
          } finally {
            controller.close();
          }
        })();
      },
    });
    const initial = await initialResult;
    if (initial.kind === "error") return initial.response;
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const result = await generateTemplateCandidate({
      tenantId: access.tenantId,
      actorId: user.id,
      provider: body.provider,
      model: body.model,
      message: body.message,
      locale: body.locale,
      sessionId: body.sessionId,
      sessionSnapshot: body.sessionSnapshot,
      recentMessages: body.recentMessages,
      sessionSummary: body.sessionSummary,
      consentVersion: body.consentVersion,
      baseHtml: body.baseHtml,
      imageIds: body.imageIds,
      imageFiles: body.imageFiles,
      stream: false,
    });
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    return mapAIStudioError(error);
  }
}
