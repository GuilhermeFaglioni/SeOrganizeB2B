import { NextResponse } from "next/server";
import {
  consumeClosedBetaRateLimit,
  getPrimaryInvitationByToken,
} from "@/lib/closed-beta/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const ip = requestIp(_request);
  if (!(await consumeClosedBetaRateLimit(`primary-lookup:${ip}`, 60, 60 * 1000))) {
    return NextResponse.json(
      { data: { status: "unavailable" }, error: null },
      { status: 200 },
    );
  }
  try {
    const invitation = await getPrimaryInvitationByToken(params.token);
    return NextResponse.json({
      data: {
        status: invitation?.status === "pending" ? "available" : "unavailable",
      },
      error: null,
    });
  } catch (error) {
    console.error("Closed Beta invitation lookup failed:", error);
    return NextResponse.json(
      { data: { status: "unavailable" }, error: null },
      { status: 200 },
    );
  }
}

function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
