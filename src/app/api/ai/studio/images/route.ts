import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  attachAIStudioImage,
  clearAIStudioImages,
  discardAIStudioImage,
  listAIStudioImages,
} from "@/lib/ai/studio-service";
import {
  mapAIStudioError,
  readJsonBody,
  requireAIStudioAccess,
  unauthorizedResponse,
} from "@/lib/ai/studio-http";

export const maxDuration = 30;

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "O envio deve ser um formulário multipart com um campo de imagem.",
        },
      },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "IMAGE_VALIDATION_ERROR",
          detailCode: "EMPTY",
          message: "Selecione uma imagem válida para anexar.",
        },
      },
      { status: 422 },
    );
  }

  try {
    const reference = await attachAIStudioImage(access.tenantId, user.id, {
      name: file.name,
      data: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      uploadId: form.get("uploadId"),
    });
    return NextResponse.json({ data: reference, error: null }, { status: 201 });
  } catch (error) {
    return mapAIStudioError(error);
  }
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  try {
    return NextResponse.json({ data: listAIStudioImages(access.tenantId, user.id), error: null });
  } catch (error) {
    return mapAIStudioError(error);
  }
}

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  const body = await readJsonBody(request);
  const imageIds = body?.imageIds;
  if (imageIds === undefined || imageIds === null) {
    clearAIStudioImages(access.tenantId, user.id);
    return NextResponse.json({ data: { cleared: true }, error: null });
  }
  if (!Array.isArray(imageIds)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Referências de imagem inválidas.",
        },
      },
      { status: 400 },
    );
  }
  for (const imageId of imageIds) {
    discardAIStudioImage(access.tenantId, user.id, imageId);
  }
  return NextResponse.json({ data: { cleared: true }, error: null });
}
