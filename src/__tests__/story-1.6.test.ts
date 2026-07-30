import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

function exists(filename: string): boolean {
  return existsSync(resolve(__dirname, "../..", filename));
}

describe("1.6.1 Comment API routes", () => {
  it("GET/POST /api/tasks/[taskId]/comments/route.ts exists", () => {
    expect(exists("src/app/api/tasks/[taskId]/comments/route.ts")).toBe(true);
    const src = read("src/app/api/tasks/[taskId]/comments/route.ts");
    expect(src).toContain("export async function GET");
    expect(src).toContain("export async function POST");
    expect(src).toContain("getUser");
    expect(src).toContain("prisma.comment");
    expect(src).toContain("createdAt");
  });

  it("DELETE /api/tasks/[taskId]/comments/[commentId]/route.ts exists", () => {
    expect(exists("src/app/api/tasks/[taskId]/comments/[commentId]/route.ts")).toBe(true);
    const src = read("src/app/api/tasks/[taskId]/comments/[commentId]/route.ts");
    expect(src).toContain("export async function DELETE");
    expect(src).toContain("params.commentId");
    expect(src).toContain("authorId");
  });
});

describe("1.6.2 useComments hook", () => {
  it("exports useComments, useCreateComment, useDeleteComment", () => {
    const src = read("src/hooks/use-comments.ts");
    expect(src).toMatch(/useComments/);
    expect(src).toMatch(/useCreateComment/);
    expect(src).toMatch(/useDeleteComment/);
    expect(src).toContain("@tanstack/react-query");
    expect(src).toContain("setQueryData");
  });
});

describe("1.6.3 CommentItem component", () => {
  it("renders avatar, author name, timestamp, content, delete button", () => {
    const src = read("src/components/comments/comment-item.tsx");
    expect(src).toContain('data-testid="comment-item"');
    expect(src).toContain("Avatar");
    expect(src).toContain("author");
    expect(src).toContain("createdAt");
    expect(src).toContain("content");
    expect(src).toContain("isOwn");
    expect(src).toContain("Trash2");
  });
});

describe("1.6.4 CommentInput component", () => {
  it("renders textarea, send button disabled when empty", () => {
    const src = read("src/components/comments/comment-input.tsx");
    expect(src).toContain('data-testid="comment-input"');
    expect(src).toContain("Send");
    expect(src).toContain("disabled");
    expect(src).toContain("textarea");
  });
});

describe("1.6.5 CommentList component", () => {
  it("renders list with CommentInput and empty state", () => {
    const src = read("src/components/comments/comment-list.tsx");
    expect(src).toContain('data-testid="comment-list"');
    expect(src).toContain("useComments");
    expect(src).toContain("CommentItem");
    expect(src).toContain("CommentInput");
    expect(src).toContain("No comments yet");
  });
});

describe("TaskDetailPanel wire-in", () => {
  it("uses CommentList instead of static comments section", () => {
    const src = read("src/components/kanban/task-detail-panel.tsx");
    expect(src).toContain("CommentList");
    expect(src).not.toContain("task._count.comments > 0");
  });
});
