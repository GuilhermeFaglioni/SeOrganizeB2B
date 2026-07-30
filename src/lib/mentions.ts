const MENTION_PATTERN = /@\[([^\]\r\n]+)\]\(([^()\s]+)\)/g;

export function extractMentionProfileIds(content: string): string[] {
  const ids = new Set<string>();
  const pattern = new RegExp(MENTION_PATTERN.source, MENTION_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    ids.add(match[2]);
  }
  return Array.from(ids);
}

export function stripMentionMarkup(content: string): string {
  return content.replace(MENTION_PATTERN, (_token, name: string) => `@${name}`);
}

export function splitMentionContent(
  content: string
): Array<{ type: "text" | "mention"; value: string; profileId?: string }> {
  const parts: Array<{
    type: "text" | "mention";
    value: string;
    profileId?: string;
  }> = [];
  let cursor = 0;
  const pattern = new RegExp(MENTION_PATTERN.source, MENTION_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const index = match.index;
    if (index > cursor) {
      parts.push({ type: "text", value: content.slice(cursor, index) });
    }
    parts.push({ type: "mention", value: `@${match[1]}`, profileId: match[2] });
    cursor = index + match[0].length;
  }
  if (cursor < content.length) {
    parts.push({ type: "text", value: content.slice(cursor) });
  }
  return parts;
}
