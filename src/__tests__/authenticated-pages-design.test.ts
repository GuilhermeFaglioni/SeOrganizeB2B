import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("authenticated page design coverage", () => {
  it("wraps every authenticated page in the Executive Quartz shell", () => {
    const layout = read("src/components/layout/app-layout.tsx");
    expect(layout).toContain("<AnimatedPage");
    expect(layout).toContain("<Sidebar");
    expect(layout).toContain("<Topbar");
  });

  it("keeps every authenticated product route present", () => {
    const pages = [
      "src/app/(authenticated)/board/page.tsx",
      "src/app/(authenticated)/board/[projectId]/page.tsx",
      "src/app/(authenticated)/all/page.tsx",
      "src/app/(authenticated)/calendar/page.tsx",
      "src/app/(authenticated)/documents/page.tsx",
      "src/app/(authenticated)/documents/[documentId]/page.tsx",
      "src/app/(authenticated)/projects/page.tsx",
      "src/app/(authenticated)/projects/[projectId]/page.tsx",
      "src/app/(authenticated)/settings/page.tsx",
      "src/app/(authenticated)/settings/profile/page.tsx",
      "src/app/(authenticated)/settings/team/page.tsx",
      "src/app/(authenticated)/settings/areas/page.tsx",
    ];

    for (const page of pages) {
      expect(existsSync(resolve(root, page)), page).toBe(true);
    }
  });

  it("removes the former product name from product-facing source", () => {
    const files = [
      "src/lib/constants.ts",
      "src/app/layout.tsx",
      "src/components/layout/sidebar.tsx",
      "package.json",
    ];
    for (const file of files) {
      expect(read(file)).not.toContain("SeOrganizeB2B");
    }
  });
});
