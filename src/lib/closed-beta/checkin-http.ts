import { NextResponse } from "next/server";
import {
  CheckinConflictError,
  CheckinEditionClosedError,
  CheckinNotFoundError,
  CheckinValidationError,
} from "./checkin";

export function mapCheckinError(error: unknown, fallback: string): NextResponse {
  if (error instanceof CheckinValidationError) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
      { status: 400 },
    );
  }
  if (error instanceof CheckinEditionClosedError) {
    return NextResponse.json(
      { data: null, error: { code: "CONFLICT", message: error.message } },
      { status: 409 },
    );
  }
  if (error instanceof CheckinConflictError) {
    return NextResponse.json(
      { data: null, error: { code: "CONFLICT", message: error.message } },
      { status: 409 },
    );
  }
  if (error instanceof CheckinNotFoundError) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: error.message } },
      { status: 404 },
    );
  }
  console.error("Check-in operation failed:", error);
  return NextResponse.json(
    { data: null, error: { code: "INTERNAL_ERROR", message: fallback } },
    { status: 500 },
  );
}
