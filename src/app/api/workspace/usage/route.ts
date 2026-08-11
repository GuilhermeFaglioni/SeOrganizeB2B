import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { countWorkspaceUsage } from "@/lib/features";
import { prisma } from "../../../../../prisma/client";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 }
  );
}

function notFound() {
  return NextResponse.json(
    { data: null, error: { code: "NOT_FOUND", message: "Workspace not found" } },
    { status: 404 }
  );
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { tenantId: true },
  });
  if (!profile?.tenantId) return notFound();

  const usage = await countWorkspaceUsage(profile.tenantId);

  return NextResponse.json({ data: usage, error: null });
}