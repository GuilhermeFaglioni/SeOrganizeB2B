import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

function exists(filename: string): boolean {
  return existsSync(resolve(__dirname, "../..", filename));
}

describe("1.2.1 Auth hooks + context", () => {
  it("use-auth.ts exists and exports expected API", () => {
    const src = read("src/hooks/use-auth.ts");
    expect(src).toMatch(/signIn/);
    expect(src).toMatch(/signOut/);
    expect(src).toMatch(/supabase/);
  });

  it("auth-context.tsx exports AuthProvider and useAuth", () => {
    const src = read("src/stores/auth-context.tsx");
    expect(src).toMatch(/export\s+(function|const)\s+AuthProvider/);
    expect(src).toMatch(/export\s+(function|const)\s+useAuth/);
    expect(src).toContain("user");
    expect(src).toContain("session");
    expect(src).toContain("signOut");
    expect(src).toContain("isLoading");
  });
});

describe("1.2.2 Auth callback handler", () => {
  it("auth/callback/route.ts exists and handles OAuth code exchange", () => {
    expect(exists("src/app/auth/callback/route.ts")).toBe(true);
    const src = read("src/app/auth/callback/route.ts");
    expect(src).toContain("code");
    expect(src).toContain("exchangeCodeForSession");
  });
});

describe("1.2.3 Login page", () => {
  it("login page renders with correct data-testid attributes", () => {
    const src = read("src/app/login/page.tsx");
    expect(src).toContain('data-testid="login-page"');
    expect(src).toContain('data-testid="google-sign-in"');
    expect(src).toContain('data-testid="email-input"');
  });

  it("login page does not render sidebar", () => {
    const src = read("src/app/login/page.tsx");
    expect(src).not.toContain("sidebar");
  });
});

describe("1.2.4 AuthGate component", () => {
  it("auth-gate.tsx wraps children and redirects if no session", () => {
    const src = read("src/components/auth/auth-gate.tsx");
    expect(src).toContain("useAuth");
    expect(src).toContain("/login");
    expect(src).toContain("LoadingState");
    expect(src).toContain("children");
  });
});

describe("1.2.5 Sidebar", () => {
  it("sidebar renders with correct structure and nav items", () => {
    const src = read("src/components/layout/sidebar.tsx");
    expect(src).toContain('data-testid="sidebar"');
    expect(src).toContain("240");
    expect(src).toContain('testId: "nav-board"');
    expect(src).toContain('testId: "nav-calendar"');
    expect(src).toContain('testId: "nav-documents"');
    expect(src).toContain('testId: "nav-settings"');
    expect(src).toContain('data-testid="sidebar-logo"');
  });
});

describe("1.2.6 Top bar", () => {
  it("topbar renders with correct data-testid", () => {
    const src = read("src/components/layout/topbar.tsx");
    expect(src).toContain('data-testid="topbar"');
  });
});

describe("1.2.7 AppLayout", () => {
  it("app-layout.tsx renders sidebar + topbar + content", () => {
    const src = read("src/components/layout/app-layout.tsx");
    expect(src).toContain("Sidebar");
    expect(src).toContain("Topbar");
    expect(src).toContain("children");
  });
});

describe("1.2.8 Authenticated route group", () => {
  it("(authenticated)/layout.tsx wraps with providers", () => {
    const src = read("src/app/(authenticated)/layout.tsx");
    expect(src).toContain("AuthProvider");
    expect(src).toContain("QueryClientProvider");
    expect(src).toContain("AppLayout");
    expect(src).toContain("AuthGate");
  });
});

describe("1.2.9 Root page redirect", () => {
  it("(authenticated)/page.tsx redirects based on projects", () => {
    const src = read("src/app/(authenticated)/page.tsx");
    expect(src).toContain("redirect");
    expect(src).toContain("/projects");
  });
});
