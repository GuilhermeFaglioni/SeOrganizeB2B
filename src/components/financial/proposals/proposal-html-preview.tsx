"use client";

import { cn } from "@/lib/utils";

export function ProposalHtmlPreview({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <iframe
      title="Preview"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={html}
      className={cn(
        "w-full overflow-hidden rounded-md border border-border bg-white",
        className
      )}
    />
  );
}
