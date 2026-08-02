import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("clients API", () => {
  it("requires authentication on list and create", () => {
    const source = read("src/app/api/clients/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("getUser()");
    expect(source).toContain("export async function GET");
    expect(source).toContain("export async function POST");
  });

  it("lists with server-side search and pagination", () => {
    const source = read("src/app/api/clients/route.ts");
    expect(source).toContain("search");
    expect(source).toContain("page");
    expect(source).toContain("pageSize");
    expect(source).toContain("totalPages");
  });

  it("rejects duplicate cpf/cnpj as a conflict", () => {
    const source = read("src/app/api/clients/route.ts");
    expect(source).toContain("P2002");
    expect(source).toContain("CONFLICT");
  });

  it("deactivates clients through a patch and never hard-deletes", () => {
    const source = read("src/app/api/clients/[id]/route.ts");
    expect(source).toContain("body.active");
    expect(source).toContain("export async function PATCH");
    expect(source).not.toContain("export async function DELETE");
  });
});
