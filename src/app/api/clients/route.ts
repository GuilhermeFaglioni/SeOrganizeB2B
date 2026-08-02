import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10))
  );
  const activeOnly = searchParams.get("active") !== "false";

  const where = {
    ...(activeOnly ? { active: true } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { cpfCnpj: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { contracts: true } } },
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    error: null,
  });
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
  const { name, legalName, cpfCnpj, email, phone, notes } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } },
      { status: 400 }
    );
  }

  try {
    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        legalName: legalName || null,
        cpfCnpj: cpfCnpj || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
      },
    });
    return NextResponse.json({ data: client, error: null }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: "CPF/CNPJ is already in use" } },
        { status: 409 }
      );
    }
    throw error;
  }
}
