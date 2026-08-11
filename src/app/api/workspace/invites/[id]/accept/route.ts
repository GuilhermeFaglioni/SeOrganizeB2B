import { NextResponse } from "next/server";
import {
  acceptInvite,
  InviteAlreadyMemberError,
  InviteNotFoundError,
} from "@/lib/invites/service";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await acceptInvite(params.id);
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof InviteNotFoundError) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );
    }
    if (error instanceof InviteAlreadyMemberError) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }
    console.error("Invite acceptance failed:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}