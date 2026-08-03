import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { sendProposal } from "@/lib/financial/proposals-service";
import { mapFinancialError } from "@/lib/financial/http";

export async function POST(
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
    const proposal = await sendProposal(params.id);
    return NextResponse.json({ data: proposal, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
