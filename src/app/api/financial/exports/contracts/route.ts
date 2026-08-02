import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { toDecimal } from "@/lib/financial/money";
import {
  CONTRACTS_CSV_HEADERS,
  csvDocument,
  csvEscape,
  moneyCell,
} from "@/lib/financial/csv";

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
  const status = searchParams.get("status") || "";
  const clientId = searchParams.get("clientId") || "";
  const projectId = searchParams.get("projectId") || "";

  const where: Prisma.ContractWhereInput = {
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projects: { some: { projectId } } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
            {
              client: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      client: { select: { name: true } },
      owner: { select: { name: true } },
    },
    orderBy: { code: "asc" },
  });

  const rows = [
    [...CONTRACTS_CSV_HEADERS],
    ...contracts.map((contract) => [
      csvEscape(contract.code),
      csvEscape(contract.title),
      csvEscape(contract.client?.name ?? ""),
      csvEscape(contract.status),
      csvEscape(contract.durationType),
      moneyCell(toDecimal(contract.officialValue ?? 0)),
      csvEscape(contract.startDate),
      csvEscape(contract.endDate),
      csvEscape(contract.billingFrequency),
      csvEscape(contract.paymentMethod),
      csvEscape(contract.owner?.name ?? ""),
    ]),
  ];

  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contracts.csv"',
    },
  });
}
