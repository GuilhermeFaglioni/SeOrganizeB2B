import { NextRequest, NextResponse } from "next/server";
import { acceptProposal } from "@/lib/financial/proposals-service";
import { mapFinancialError } from "@/lib/financial/http";

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "The acceptor name is required" },
      },
      { status: 400 }
    );
  }

  try {
    const proposal = await acceptProposal(params.token, body.name);
    return NextResponse.json({ data: proposal, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
