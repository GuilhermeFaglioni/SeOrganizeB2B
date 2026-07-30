import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(__dirname, "../app/(authenticated)/board/page.tsx"),
  "utf8"
);

describe("All Projects DnD", () => {
  it("mounts one compact DnD board per project", () => {
    expect(source).toContain("<KanbanBoard");
    expect(source).toContain('mode="compact"');
    expect(source).toContain("allowColumnManagement={false}");
    expect(source).toContain("projectId={projectId}");
  });
});
