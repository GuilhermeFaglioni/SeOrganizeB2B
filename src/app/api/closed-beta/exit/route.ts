import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { prisma } from "../../../../../prisma/client";
import { removeClosedBetaEnrollment } from "@/lib/closed-beta/service";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 },
  );
}

function badRequest(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
}

export async function POST() {
  const user = await getUser();
  if (!user) return unauthorized();

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { tenantId: true, removedAt: true },
  });
  if (!profile || profile.removedAt) {
    return badRequest("Profile not found or removed");
  }

  const enrollment = await prisma.closedBetaEnrollment.findUnique({
    where: { workspaceId: profile.tenantId },
    select: { status: true, ownerProfileId: true },
  });
  if (!enrollment || enrollment.status !== "active") {
    return badRequest("Workspace is not enrolled in the Closed Beta");
  }

  if (enrollment.ownerProfileId !== user.id) {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "Only the workspace owner can leave the Closed Beta" } },
      { status: 403 },
    );
  }

  try {
    await removeClosedBetaEnrollment(profile.tenantId, {
      userId: user.id,
      email: user.email ?? "",
    });
    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error("Failed to leave Closed Beta:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Unable to process the request" } },
      { status: 500 },
    );
  }
}
