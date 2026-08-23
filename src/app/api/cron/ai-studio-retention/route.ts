import { pruneAllAIStudioUsageEvents } from "@/lib/ai/studio-service";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { data: null, error: { code: "CRON_NOT_CONFIGURED" } },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return Response.json(
      { data: null, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  try {
    const workspaceCount = await pruneAllAIStudioUsageEvents();
    return Response.json({ data: { workspaceCount }, error: null });
  } catch {
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
