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

  it("publishes the official controller and Google data disclosures", () => {
    const legal = read("src/components/marketing/legal-page.tsx");
    const messages = read("messages/pt-BR.json");
    expect(legal).not.toContain("placeholderNotice");
    expect(messages).not.toContain("TODO_");
    expect(messages).toContain("55.823.385 GUILHERME COSTA BARBOSA FAGLIONI");
    expect(messages).toContain("guilhermefaglioni.contato@gmail.com");
    expect(messages).toContain("Google Calendar");
  });
});
