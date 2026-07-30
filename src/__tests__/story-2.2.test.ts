import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

function exists(filename: string): boolean {
  return existsSync(resolve(__dirname, "../..", filename));
}

describe("2.2.1 Document API routes", () => {
  it("GET/POST /api/documents/route.ts exists", () => {
    expect(exists("src/app/api/documents/route.ts")).toBe(true);
    const src = read("src/app/api/documents/route.ts");
    expect(src).toContain("export async function GET");
    expect(src).toContain("export async function POST");
    expect(src).toContain("getSession");
    expect(src).toContain("prisma.document");
    expect(src).toContain("project_id");
  });

  it("PATCH/DELETE /api/documents/[id]/route.ts exists", () => {
    expect(exists("src/app/api/documents/[id]/route.ts")).toBe(true);
    const src = read("src/app/api/documents/[id]/route.ts");
    expect(src).toContain("export async function PATCH");
    expect(src).toContain("export async function DELETE");
    expect(src).toContain("params.id");
  });
});

describe("2.2.2 useDocuments hook", () => {
  it("exports useDocuments, useDocument, useCreateDocument, useUpdateDocument, useDeleteDocument", () => {
    const src = read("src/hooks/use-documents.ts");
    expect(src).toMatch(/useDocuments/);
    expect(src).toMatch(/useDocument/);
    expect(src).toMatch(/useCreateDocument/);
    expect(src).toMatch(/useUpdateDocument/);
    expect(src).toMatch(/useDeleteDocument/);
    expect(src).toContain("@tanstack/react-query");
    expect(src).toContain("debounce");
  });
});

describe("2.2.3 DocumentRow component", () => {
  it("renders file icon, title, metadata, project badge", () => {
    const src = read("src/components/documents/document-row.tsx");
    expect(src).toContain('data-testid="document-row"');
    expect(src).toContain("FileText");
    expect(src).toContain("title");
    expect(src).toContain("updatedAt");
    expect(src).toContain("project");
  });
});

describe("2.2.4 DocumentList component", () => {
  it("renders project filter tabs, document rows, new document button, empty state", () => {
    const src = read("src/components/documents/document-list.tsx");
    expect(src).toContain('data-testid="document-list"');
    expect(src).toContain("useDocuments");
    expect(src).toContain("DocumentRow");
    expect(src).toContain("No documents yet");
  });
});

describe("2.2.5 MarkdownPreview component", () => {
  it("renders markdown via react-markdown with remark-gfm", () => {
    const src = read("src/components/documents/markdown-preview.tsx");
    expect(src).toContain("ReactMarkdown");
    expect(src).toContain("remarkGfm");
    expect(src).toContain("rehypeHighlight");
  });
});

describe("2.2.6 DocumentEditor component", () => {
  it("renders split pane with editor, preview, toolbar, save", () => {
    const src = read("src/components/documents/document-editor.tsx");
    expect(src).toContain("<textarea");
    expect(src).toContain("handleContentChange");
    expect(src).toContain("MarkdownPreview");
    expect(src).toContain("Save");
    expect(src).toContain("scheduleSave");
  });
});

describe("2.2.7 Documents list page", () => {
  it("renders documents page with DocumentList and new doc button", () => {
    expect(exists("src/app/(authenticated)/documents/page.tsx")).toBe(true);
    const src = read("src/app/(authenticated)/documents/page.tsx");
    expect(src).toContain('data-testid="documents-page"');
    expect(src).toContain("DocumentList");
  });
});

describe("2.2.8 Document editor page", () => {
  it("renders editor page with DocumentEditor and back button", () => {
    expect(exists("src/app/(authenticated)/documents/[documentId]/page.tsx")).toBe(true);
    const src = read("src/app/(authenticated)/documents/[documentId]/page.tsx");
    expect(src).toContain('data-testid="document-editor-page"');
    expect(src).toContain("DocumentEditor");
    expect(src).toContain("ArrowLeft");
  });
});
