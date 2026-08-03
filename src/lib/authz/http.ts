import { NextResponse } from "next/server";
import { RoleValidationError } from "./roles-service";

export function mapRoleError(error: unknown): NextResponse {
  if (error instanceof RoleValidationError) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: error.message },
      },
      { status: 400 }
    );
  }
  console.error("Role operation failed:", error);
  return NextResponse.json(
    {
      data: null,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    },
    { status: 500 }
  );
}
