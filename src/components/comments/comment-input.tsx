"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

export function CommentInput({
  onSubmit,
  isPending,
}: {
  onSubmit: (content: string) => void;
  isPending?: boolean;
}) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = !content.trim();

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.max(80, ta.scrollHeight)}px`;
    }
  }, []);

  function handleSubmit() {
    if (isEmpty) return;
    onSubmit(content.trim());
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "80px";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div data-testid="comment-input" className="flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Write a comment..."
        className="flex-1 min-h-[80px] resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <button
        onClick={handleSubmit}
        disabled={isEmpty || isPending}
        className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-accent text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors shrink-0"
        aria-label="Send comment"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
