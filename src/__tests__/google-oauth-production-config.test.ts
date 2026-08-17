import { afterEach, describe, expect, it } from "vitest";
import { getSiteOrigin } from "../lib/site-url";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Google OAuth production configuration", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
  });

  it("uses the configured canonical origin instead of the request host", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://seorganize.faglionidev.com/";

    expect(getSiteOrigin("https://untrusted.example")).toBe(
      "https://seorganize.faglionidev.com",
    );
  });

  it("allows localhost for development but rejects insecure configured hosts", () => {
    process.env.APP_URL = "http://localhost:3000";
    expect(getSiteOrigin()).toBe("http://localhost:3000");

    process.env.APP_URL = "http://seorganize.faglionidev.com";
    expect(() => getSiteOrigin()).toThrow(/HTTPS/);
  });

  it("documents the canonical domain, exact callback and production gate", () => {
    const runbook = read("docs/google-oauth-production-runbook.md");
    const workflow = read(".github/workflows/deploy-production.yml");
    expect(runbook).toContain("seorganize.faglionidev.com");
    expect(runbook).toContain(
      "https://seorganize.faglionidev.com/api/calendar/auth/callback",
    );
    expect(runbook).toContain("GOOGLE_TOKEN_ENCRYPTION_KEY");
    expect(workflow).toContain("security:check-legal-placeholders");
  });
});
