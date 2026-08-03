import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.clients.view");
  if (denied) return denied;

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      contracts: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { projects: true } },
        },
      },
    },
  });

  if (!client) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Client not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: client, error: null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.clients.edit");
  if (denied) return denied;

  const body = await request.json();

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } },
        { status: 400 }
      );
    }
  }

  try {
    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        legalName: body.legalName !== undefined ? body.legalName : undefined,
        cpfCnpj: body.cpfCnpj !== undefined ? body.cpfCnpj || null : undefined,
        email: body.email !== undefined ? body.email || null : undefined,
        phone: body.phone !== undefined ? body.phone || null : undefined,
        notes: body.notes !== undefined ? body.notes || null : undefined,
        active: body.active !== undefined ? body.active : undefined,
      },
    });
    return NextResponse.json({ data: client, error: null });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: "CPF/CNPJ is already in use" } },
        { status: 409 }
      );
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }
    throw error;
  }
}
