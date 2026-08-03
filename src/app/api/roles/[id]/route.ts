import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { mapRoleError } from "@/lib/authz/http";
import {
  deleteRole,
  getRole,
  updateRole,
} from "@/lib/authz/roles-service";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const role = await getRole(params.id);
  if (!role) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Role not found" } },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: role, error: null });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const body = await request.json();
  const input: { name?: string; permissions?: string[] } = {};
  if (body.name !== undefined) input.name = String(body.name);
  if (body.permissions !== undefined) input.permissions = body.permissions;

  try {
    const role = await updateRole(params.id, input);
    return NextResponse.json({ data: role, error: null });
  } catch (error) {
    return mapRoleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  try {
    await deleteRole(params.id);
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    return mapRoleError(error);
  }
}
