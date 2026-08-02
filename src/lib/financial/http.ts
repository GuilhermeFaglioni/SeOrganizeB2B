import { NextResponse } from "next/server";
import {
  FinancialConflictError,
  FinancialValidationError,
} from "./lifecycle";

export function qs(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data as T;
}

export function mapFinancialError(error: unknown): NextResponse {
  if (error instanceof FinancialValidationError) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: error.message },
      },
      { status: 400 }
    );
  }
  if (error instanceof FinancialConflictError) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "CONFLICT", message: error.message },
      },
      { status: 409 }
    );
  }
  return NextResponse.json(
    {
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}
