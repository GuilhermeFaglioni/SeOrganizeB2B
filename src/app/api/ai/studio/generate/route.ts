import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { generateTemplateCandidate } from "@/lib/ai/studio-service";
import {
  mapAIStudioError,
  readJsonBody,
  requireAIStudioAccess,
  unauthorizedResponse,
} from "@/lib/ai/studio-http";

export const maxDuration = 90;

function newlineJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Corpo da requisição inválido." } },
      { status: 400 },
    );
  }

  if (body.stream === true) {
    const encoder = new TextEncoder();
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
                stream: true,
              },
              {
                onPartial: (text) => {
                  controller.enqueue(encoder.encode(newlineJson({ type: "delta", text })));
                },
              },
            );
            controller.enqueue(encoder.encode(newlineJson({ type: "complete", data: result })));
          } catch (error) {
            const response = mapAIStudioError(error);
            const payload = await response.json();
            controller.enqueue(encoder.encode(newlineJson({ type: "error", ...payload })));
          } finally {
            controller.close();
          }
        })();
      },
    });
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
      stream: false,
    });
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    return mapAIStudioError(error);
  }
}
