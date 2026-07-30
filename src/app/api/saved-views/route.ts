import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const views = await prisma.savedView.findMany({
    where: { userId: user.id, scope: "board" },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: views, error: null });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (
    !name ||
    name.length > 80 ||
    body.scope !== "board" ||
    !body.filters ||
    typeof body.filters !== "object" ||
    Array.isArray(body.filters)
  ) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Invalid saved view" },
      },
      { status: 400 }
    );
  }
  try {
    const view = await prisma.savedView.create({
      data: {
        userId: user.id,
        name,
        scope: "board",
        filters: body.filters,
      },
    });
    return NextResponse.json({ data: view, error: null }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "CONFLICT", message: "View name already exists" },
        },
        { status: 409 }
      );
    }
    throw error;
  }
}
