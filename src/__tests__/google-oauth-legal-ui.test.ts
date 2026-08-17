import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Google OAuth legal surface", () => {
  it("keeps the public legal routes available without authentication", () => {
    for (const route of [
      "src/app/(marketing)/privacy/page.tsx",
      "src/app/(marketing)/terms/page.tsx",
      "src/app/(marketing)/contact/page.tsx",
    ]) {
      expect(existsSync(resolve(root, route)), route).toBe(true);
    }
  });

  it("links legal pages from marketing and login surfaces", () => {
    expect(read("src/app/(marketing)/layout.tsx")).toContain('href="/privacy"');
    expect(read("src/app/(marketing)/layout.tsx")).toContain('href="/terms"');
    expect(read("src/app/login/page.tsx")).toContain('href="/privacy"');
    expect(read("src/app/login/page.tsx")).toContain('href="/terms"');
  });

  it("marks controlled legal placeholders so they cannot be mistaken for final policy", () => {
    const legal = read("src/components/marketing/legal-page.tsx");
    const messages = read("messages/pt-BR.json");
    expect(legal).toContain("placeholderNotice");
    expect(messages).toContain("TODO_LEGAL_ENTITY_NAME");
    expect(messages).toContain("TODO_PRIVACY_EMAIL");
    expect(messages).toContain("Google Calendar");
  });
});
