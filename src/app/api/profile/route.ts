import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } }, { status: 400 });
  }

  const normalizedName = name.trim();
  const supabase = await createClient();
  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: normalizedName },
  });
  if (authError) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "AUTH_UPDATE_ERROR",
          message: authError.message,
        },
      },
      { status: 502 },
    );
  }

  const updated = await prisma.profile.update({
    where: { id: session.user.id },
    data: { name: normalizedName },
  });

  return NextResponse.json({ data: { id: updated.id, name: updated.name, email: updated.email }, error: null });
}
