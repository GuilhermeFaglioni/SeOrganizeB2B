import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockExchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.mockExchangeCodeForSession },
  }),
}));

import { GET } from "../app/auth/callback/route";

const makeCallbackRequest = (query = "code=test-code") =>
  new NextRequest(`http://localhost:3000/auth/callback?${query}`);

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockExchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: "user-1", email: "user@example.com" } } },
      error: null,
    });
  });

  it("redirects to /login when the code exchange fails", async () => {
    mocks.mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid code" },
    });

    const res = await GET(makeCallbackRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("redirects successful authentication to the app for onboarding gating", async () => {
    const res = await GET(makeCallbackRequest("code=test-code&invite=legacy-token"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/app");
    expect(mocks.mockExchangeCodeForSession).toHaveBeenCalledWith("test-code");
  });

  it("redirects requests without a code to the app", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/auth/callback"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/app");
    expect(mocks.mockExchangeCodeForSession).not.toHaveBeenCalled();
  });
});
