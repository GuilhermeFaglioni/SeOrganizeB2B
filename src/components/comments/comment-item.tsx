"use client";

import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CommentAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface CommentItemComment {
  id: string;
  content: string;
  createdAt: string;
  author: CommentAuthor;
}

export function CommentItem({
  comment,
  isOwn,
  onDelete,
}: {
  comment: CommentItemComment;
  isOwn?: boolean;
  onDelete?: (id: string) => void;
}) {
  const initials = comment.author.name
    ? comment.author.name.charAt(0).toUpperCase()
    : "?";

  return (
    <div data-testid="comment-item" className="flex gap-3">
      <Avatar className="w-7 h-7 shrink-0">
        <AvatarImage src={comment.author.avatarUrl || undefined} alt={comment.author.name || "User"} />
        <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text-primary">
              {comment.author.name || "Unknown"}
            </span>
            <span className="text-[12px] text-text-secondary">
              {new Date(comment.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {isOwn && onDelete && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-text-secondary hover:text-danger transition-colors shrink-0"
              aria-label="Delete comment"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <p className="text-[14px] text-text-primary mt-0.5 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>
    </div>
  );
}
