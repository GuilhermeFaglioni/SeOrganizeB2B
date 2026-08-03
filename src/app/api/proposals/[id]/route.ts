import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  deleteProposal,
  getProposal,
  updateProposalDraft,
} from "@/lib/financial/proposals-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { mapFinancialError } from "@/lib/financial/http";

function parseUpdateInput(body: Record<string, unknown>) {
  const errors: string[] = [];
  const input: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) errors.push("A title is required");
    input.title = title;
  }
  if (body.clientId !== undefined) {
    if (typeof body.clientId !== "string" || !body.clientId) {
      errors.push("A client is required");
    } else {
      input.clientId = body.clientId;
    }
  }
  if (body.templateId !== undefined) {
    input.templateId =
      typeof body.templateId === "string" && body.templateId ? body.templateId : null;
  }
  if (body.totalValue !== undefined) {
    if (body.totalValue === null || body.totalValue === "") {
      input.totalValue = null;
    } else {
      const raw = String(body.totalValue);
      if (isNaN(Number(raw))) errors.push("Total value must be a valid number");
      else input.totalValue = raw;
    }
  }
  if (body.issueDate !== undefined) {
    const value = body.issueDate ? String(body.issueDate) : null;
    if (value && !isCivilDate(value)) errors.push("Issue date must be a valid date");
    input.issueDate = value;
  }
  if (body.validUntil !== undefined) {
    const value = body.validUntil ? String(body.validUntil) : null;
    if (value && !isCivilDate(value)) errors.push("Validity date must be a valid date");
    input.validUntil = value;
  }
  if (body.variables !== undefined) {
    if (typeof body.variables !== "object" || body.variables === null || Array.isArray(body.variables)) {
      errors.push("Variables must be an object");
    } else {
      input.variables = body.variables;
    }
  }
  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      errors.push("Items must be an array");
    } else {
      (body.items as Record<string, unknown>[]).forEach((item, index) => {
        if (typeof item.name !== "string" || !item.name.trim()) {
          errors.push(`Item ${index + 1} needs a name`);
        }
      });
      input.items = body.items;
    }
  }

  return { errors, input };
}

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

  const proposal = await getProposal(params.id);
  if (!proposal) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "NOT_FOUND", message: "Proposal not found" },
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: proposal, error: null });
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
  const { errors, input } = parseUpdateInput(body);
  if (errors.length > 0) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: errors.join("; ") },
      },
      { status: 400 }
    );
  }

  try {
    const proposal = await updateProposalDraft(params.id, input as never);
    return NextResponse.json({ data: proposal, error: null });
  } catch (error) {
    return mapFinancialError(error);
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
    await deleteProposal(params.id);
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
