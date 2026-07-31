import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { data: null, error: { code: "CONFIG_ERROR", message: "VAPID keys not configured" } },
      { status: 500 }
    );
  }
  return NextResponse.json({ data: { publicKey }, error: null });
}
