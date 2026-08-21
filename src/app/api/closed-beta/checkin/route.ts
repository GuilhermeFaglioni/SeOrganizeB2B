import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { mapCheckinError } from "@/lib/closed-beta/checkin-http";
import {
  getWorkspaceCheckin,
  submitCheckinResponse,
} from "@/lib/closed-beta/checkin";
import { prisma } from "../../../../../prisma/client";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 },
  );
}

function forbidden() {
  return NextResponse.json(
    { data: null, error: { code: "FORBIDDEN", message: "Forbidden" } },
    { status: 403 },
  );
}

function badRequest(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
}

async function loadProfile(userId: string) {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { tenantId: true, removedAt: true, email: true },
  });
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  const profile = await loadProfile(user.id);
  if (!profile || profile.removedAt) return forbidden();

  try {
    const status = await getWorkspaceCheckin(profile.tenantId);
    let edition = null;
    let memberSubmitted = false;
    if (status.editionId && status.workspaceStatus !== "not_applicable") {
      edition = await prisma.closedBetaCheckinEdition.findUnique({
        where: { id: status.editionId },
        include: { questions: { orderBy: { position: "asc" } } },
      });
      const existing = await prisma.closedBetaCheckinResponse.findFirst({
        where: {
          editionId: status.editionId,
          profileId: user.id,
          isCurrent: true,
        },
        select: { id: true },
      });
      memberSubmitted = Boolean(existing);
    }
    return NextResponse.json({
      data: {
        blocked: status.blocked,
        phase: status.phase,
        workspaceStatus: status.workspaceStatus,
        editionId: status.editionId,
        workspaceId: profile.tenantId,
        profileId: user.id,
        edition,
        memberSubmitted,
      },
      error: null,
    });
  } catch (error) {
    return mapCheckinError(error, "Unable to load the check-in status");
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return unauthorized();

  const profile = await loadProfile(user.id);
  if (!profile || profile.removedAt) return forbidden();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("Invalid request body");
  }

  const { editionId, answers, didNotUse } = body as Record<string, unknown>;
  if (typeof editionId !== "string" || editionId.trim() === "") {
    return badRequest("editionId is required");
  }
  if (answers !== undefined && (typeof answers !== "object" || answers === null || Array.isArray(answers))) {
    return badRequest("answers must be an object");
  }
  if (didNotUse !== undefined && typeof didNotUse !== "boolean") {
    return badRequest("didNotUse must be a boolean");
  }

  try {
    const result = await submitCheckinResponse({
      editionId: editionId.trim(),
      workspaceId: profile.tenantId,
      profileId: user.id,
      answers: (answers as Record<string, unknown>) ?? {},
      didNotUse: didNotUse as boolean | undefined,
      actor: { userId: user.id, email: user.email ?? profile.email ?? "" },
    });
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    return mapCheckinError(error, "Unable to submit the check-in response");
  }
}
