import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (file: string) =>
  readFileSync(resolve(__dirname, "../..", file), "utf8");

describe("personal saved views", () => {
  it("scopes list, create, and delete to the session user", () => {
    const list = read("src/app/api/saved-views/route.ts");
    const item = read("src/app/api/saved-views/[id]/route.ts");
    expect(list.match(/userId: session\.user\.id/g)?.length).toBeGreaterThan(1);
    expect(item).toContain("userId: session.user.id");
  });

  it("stores and applies board filter state", () => {
    const board = read("src/app/(authenticated)/board/page.tsx");
    expect(board).toContain("SavedViewControl");
    expect(board).toContain("applySavedView");
  });
});
