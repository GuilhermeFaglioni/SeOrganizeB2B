"use client";

import { useComments, useCreateComment, useDeleteComment } from "@/hooks/use-comments";
import { useAuth } from "@/stores/auth-context";
import { useTranslations } from "next-intl";
import { CommentItem } from "./comment-item";
import { CommentInput } from "./comment-input";

export function CommentList({ taskId }: { taskId: string }) {
  const t = useTranslations("comments.list");
  const { data: comments, isLoading } = useComments(taskId);
  const createComment = useCreateComment(taskId);
  const deleteComment = useDeleteComment(taskId);
  const { user } = useAuth();

  function handleSubmit(content: string) {
    createComment.mutate({ content });
  }

  function handleDelete(commentId: string) {
    deleteComment.mutate(commentId);
  }

  return (
    <div data-testid="comment-list" className="space-y-4">
      <h3 className="text-label font-semibold text-text-primary flex items-center gap-1">
        {t("heading", { count: comments?.length || 0 })}
      </h3>

      <CommentInput onSubmit={handleSubmit} isPending={createComment.isPending} />

      {isLoading && (
        <div className="text-body-small text-text-secondary text-center py-4">{t("loading")}</div>
      )}

      {!isLoading && comments && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isOwn={comment.authorId === user?.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {!isLoading && comments && comments.length === 0 && (
        <div className="text-body-small text-text-secondary text-center py-4">
          {t("empty")}
        </div>
      )}
    </div>
  );
}
