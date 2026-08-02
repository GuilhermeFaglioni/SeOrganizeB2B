import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import {
  deleteDraftContract,
  updateContract,
} from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";

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

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      owner: { select: { id: true, name: true, email: true } },
      predecessor: {
        select: { id: true, code: true, title: true, status: true },
      },
      successors: {
        select: { id: true, code: true, title: true, status: true },
      },
      items: { orderBy: { position: "asc" } },
      projects: { include: { project: { select: { id: true, name: true } } } },
      installments: { orderBy: { dueDate: "asc" } },
      changes: {
        orderBy: { effectiveDate: "desc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      audits: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!contract) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "NOT_FOUND", message: "Contract not found" },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: contract, error: null });
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

  const body = await request.json();
  const input: Record<string, unknown> = {};
  for (const field of [
    "title",
    "clientId",
    "ownerId",
    "durationType",
    "officialValue",
    "startDate",
    "endDate",
    "billingFrequency",
    "paymentMethod",
    "documentUrl",
    "notes",
    "status",
  ]) {
    if (body[field] !== undefined) input[field] = body[field];
  }
  if (input.officialValue !== undefined)
    input.officialValue = String(input.officialValue);
  if (input.startDate !== undefined && !isCivilDate(input.startDate as string)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Start date must be a valid date",
        },
      },
      { status: 400 }
    );
  }

  try {
    const contract = await updateContract(params.id, input, user.id);
    return NextResponse.json({ data: contract, error: null });
  } catch (error) {
    const name = (error as { name?: string }).name;
    const status = name === "FinancialConflictError" ? 409 : 500;
    const code = name === "FinancialConflictError" ? "CONFLICT" : "INTERNAL_ERROR";
    return NextResponse.json(
      { data: null, error: { code, message: (error as Error).message } },
      { status }
    );
  }
}

export async function DELETE(
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

  try {
    await deleteDraftContract(params.id);
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    const name = (error as { name?: string }).name;
    const status = name === "FinancialConflictError" ? 409 : 500;
    const code = name === "FinancialConflictError" ? "CONFLICT" : "INTERNAL_ERROR";
    return NextResponse.json(
      { data: null, error: { code, message: (error as Error).message } },
      { status }
    );
  }
}
