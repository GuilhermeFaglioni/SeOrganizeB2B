import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (file: string) =>
  readFileSync(resolve(__dirname, "../..", file), "utf8");

describe("Hoje cockpit", () => {
  it("loads assigned due work excluding complete columns", () => {
    const route = read("src/app/api/today/tasks/route.ts");
    expect(route).toContain("profileId: session.user.id");
    expect(route).toContain("dueDate: { lte: endOfToday }");
    expect(route).toContain("completesTasks: false");
  });

  it("composes tasks, agenda, activity, and unread count", () => {
    const page = read("src/app/(authenticated)/page.tsx");
    expect(page).toContain("TodayTasks");
    expect(page).toContain("TodayAgenda");
    expect(page).toContain("TodayActivity");
    expect(page).toContain("unreadCount");
  });

  it("mounts Hoje first in sidebar", () => {
    expect(read("src/components/layout/sidebar.tsx")).toContain(
      '{ href: "/", label: "Hoje"'
    );
  });
});
