import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { todayCivilDate } from "@/lib/financial/civil-date";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || "";
  const projectId = searchParams.get("projectId") || "";
  const parsedPage = parseInt(searchParams.get("page") || "", 10);
  const page = Number.isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);
  const parsedPageSize = parseInt(searchParams.get("pageSize") || "", 10);
  const pageSize = Number.isNaN(parsedPageSize)
    ? 25
    : Math.min(100, Math.max(1, parsedPageSize));

  const today = todayCivilDate();
  const where: Prisma.InstallmentWhereInput = {
    ...(projectId
      ? { contract: { projects: { some: { projectId } } } }
      : {}),
    ...(status === "overdue"
      ? { status: "pending", dueDate: { lt: today } }
      : status
        ? { status }
        : {}),
  };

  const [items, total] = await Promise.all([
    prisma.installment.findMany({
      where,
      include: {
        contract: {
          include: { client: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.installment.count({ where }),
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
