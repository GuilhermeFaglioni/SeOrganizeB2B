import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { toDecimal } from "@/lib/financial/money";
import { todayCivilDate } from "@/lib/financial/civil-date";
import {
  RECEIVABLES_CSV_HEADERS,
  csvDocument,
  csvEscape,
  moneyCell,
} from "@/lib/financial/csv";
import { denyFor } from "@/lib/authz/authz";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.receivables.view");
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || "";
  const clientId = searchParams.get("clientId") || "";
  const projectId = searchParams.get("projectId") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const today = todayCivilDate();

  const where: Prisma.InstallmentWhereInput = {
    ...(status === "overdue"
      ? { status: "pending", dueDate: { lt: today } }
      : status
        ? { status }
        : {}),
    ...(clientId ? { contract: { clientId } } : {}),
    ...(projectId
      ? { contract: { projects: { some: { projectId } } } }
      : {}),
    ...(from || to
      ? {
          dueDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const installments = await prisma.installment.findMany({
    where,
    include: {
      contract: {
        include: { client: { select: { name: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const rows = [
    [...RECEIVABLES_CSV_HEADERS],
    ...installments.map((installment) => [
      csvEscape(installment.contract.code),
      csvEscape(installment.contract.title),
      csvEscape(installment.contract.client?.name ?? ""),
      moneyCell(toDecimal(installment.expectedAmount)),
      csvEscape(installment.status),
      csvEscape(installment.dueDate),
      csvEscape(installment.paymentMethod),
      csvEscape(installment.paidAt),
    ]),
  ];

  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="receivables.csv"',
    },
  });
}
