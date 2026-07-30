import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("profile and toast contracts", () => {
  it("mounts a functional toaster in the authenticated app", () => {
    expect(read("src/app/(authenticated)/layout.tsx")).toContain("<Toaster");
    const source = read("src/components/ui/toaster.tsx");
    expect(source).toContain('addEventListener("app-toast"');
    expect(source).toContain('removeEventListener("app-toast"');
    expect(source).toContain('aria-live="polite"');
  });

  it("updates Supabase metadata and Prisma profile", () => {
    const source = read("src/app/api/profile/route.ts");
    expect(source).toContain("supabase.auth.updateUser");
    expect(source).toContain("prisma.profile.update");
    expect(source).toContain("full_name");
  });

  it("updates visible auth state immediately", () => {
    expect(read("src/stores/auth-context.tsx")).toContain("updateUserName");
    expect(
      read("src/app/(authenticated)/settings/profile/page.tsx"),
    ).toContain("updateUserName(data.data.name)");
  });
});
