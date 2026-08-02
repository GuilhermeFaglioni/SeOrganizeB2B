"use client";

import {
  useState,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useProfiles } from "@/hooks/use-profiles";

export function CommentInput({
  onSubmit,
  isPending,
}: {
  onSubmit: (content: string) => void;
  isPending?: boolean;
}) {
  const t = useTranslations("comments.input");
  const [content, setContent] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: profiles = [] } = useProfiles();

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
    if (mentionQuery !== null && e.key === "Escape") {
      setMentionQuery(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    const beforeCaret = value.slice(0, e.target.selectionStart);
    const match = beforeCaret.match(/@([\w.-]*)$/);
    setContent(value);
    setMentionQuery(match?.[1] ?? null);
    adjustHeight();
  }

  function insertMention(profile: {
    id: string;
    name: string | null;
    email: string;
  }) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const beforeCaret = content.slice(0, caret);
    const queryMatch = beforeCaret.match(/@([\w.-]*)$/);
    if (!queryMatch) return;
    const start = caret - queryMatch[0].length;
    const label = profile.name || profile.email;
    const token = `@[${label}](${profile.id}) `;
    const next = `${content.slice(0, start)}${token}${content.slice(caret)}`;
    setContent(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const nextCaret = start + token.length;
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
      adjustHeight();
    });
  }

  const mentionOptions =
    mentionQuery === null
      ? []
      : profiles
          .filter((profile) => {
            const search = mentionQuery.toLowerCase();
            return (
              (profile.name || "").toLowerCase().includes(search) ||
              profile.email.toLowerCase().includes(search)
            );
          })
          .slice(0, 6);

  return (
    <div data-testid="comment-input" className="relative flex gap-2 items-end">
      <div className="relative flex-1">
        {mentionQuery !== null && mentionOptions.length > 0 && (
          <div
            className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-page-alt p-1 shadow-lg"
            role="listbox"
            aria-label={t("mentionAria")}
          >
            {mentionOptions.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-bg-secondary"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(profile)}
              >
                <span className="font-medium">{profile.name || profile.email}</span>
                <span className="truncate text-xs text-text-secondary">
                  {profile.email}
                </span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          className="w-full min-h-[80px] resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={isEmpty || isPending}
        className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-accent text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors shrink-0"
        aria-label={t("sendAria")}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
