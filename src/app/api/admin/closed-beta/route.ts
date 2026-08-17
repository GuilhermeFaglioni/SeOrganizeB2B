import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import {
  ClosedBetaValidationError,
  getClosedBetaConfig,
  getClosedBetaMetrics,
  updateClosedBetaConfig,
} from "@/lib/closed-beta/service";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 },
  );
}

function forbidden() {
  return NextResponse.json(
    { data: null, error: { code: "FORBIDDEN", message: "Forbidden" } },
    { status: 403 },
  );
}

async function requireSuperAdmin() {
  const user = await getUser();
  if (!user) return { user: null, response: unauthorized() };
  if (!(await getSuperAdminStatus(user.id))) {
    return { user: null, response: forbidden() };
  }
  return { user, response: null };
}

export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate.response) return gate.response;

  try {
    const [config, metrics] = await Promise.all([
      getClosedBetaConfig(),
      getClosedBetaMetrics(),
    ]);
    return NextResponse.json({ data: { config, metrics }, error: null });
  } catch (error) {
    console.error("Closed Beta config load failed:", error);
    return NextResponse.json(
      {
        data: null,
        error: { code: "INTERNAL_ERROR", message: "Unable to load Closed Beta" },
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const gate = await requireSuperAdmin();
  if (gate.response || !gate.user) return gate.response ?? unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
      { status: 400 },
    );
  }

  const candidate = body as Record<string, unknown>;
  const input: {
    status?: "active" | "paused" | "closed";
    maxPrimaryWorkspaces?: number;
    maxGuestsPerWorkspace?: number;
  } = {};

  if (candidate.status !== undefined) {
    if (
      candidate.status !== "active" &&
      candidate.status !== "paused" &&
      candidate.status !== "closed"
    ) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: "Invalid status" } },
        { status: 400 },
      );
    }
    input.status = candidate.status;
  }

  if (candidate.maxPrimaryWorkspaces !== undefined) {
    if (!Number.isInteger(candidate.maxPrimaryWorkspaces)) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "maxPrimaryWorkspaces must be an integer" },
        },
        { status: 400 },
      );
    }
    input.maxPrimaryWorkspaces = candidate.maxPrimaryWorkspaces as number;
  }

  if (candidate.maxGuestsPerWorkspace !== undefined) {
    if (!Number.isInteger(candidate.maxGuestsPerWorkspace)) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "maxGuestsPerWorkspace must be an integer" },
        },
        { status: 400 },
      );
    }
    input.maxGuestsPerWorkspace = candidate.maxGuestsPerWorkspace as number;
  }

  try {
    const config = await updateClosedBetaConfig(input, {
      userId: gate.user.id,
      email: gate.user.email ?? "",
    });
    const metrics = await getClosedBetaMetrics();
    return NextResponse.json({ data: { config, metrics }, error: null });
  } catch (error) {
    if (error instanceof ClosedBetaValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 },
      );
    }
    console.error("Closed Beta config update failed:", error);
    return NextResponse.json(
      {
        data: null,
        error: { code: "INTERNAL_ERROR", message: "Unable to update Closed Beta" },
      },
      { status: 500 },
    );
  }
}
