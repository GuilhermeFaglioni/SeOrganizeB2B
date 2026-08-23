"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const IMMERSIVE_STYLES = `
  :root { color-scheme: light; }
  html, body { min-height: 0 !important; background: #ffffff !important; }
  body { margin: 0 !important; overflow: hidden !important; }
  .proposal {
    max-width: none !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  .proposal > .header {
    padding: clamp(4rem, 9vw, 8rem) clamp(1.5rem, 8vw, 9rem) !important;
  }
  .proposal > .body {
    width: min(100%, 1120px) !important;
    margin: 0 auto !important;
    padding: clamp(3.5rem, 7vw, 7rem) clamp(1.5rem, 5vw, 4rem) !important;
  }
  .proposal > .footer {
    padding: 2rem clamp(1.5rem, 8vw, 9rem) !important;
  }
  .proposal .acceptance,
  .proposal .sign { display: none !important; }
  .proposal .items { overflow-x: auto; }
  @media (max-width: 640px) {
    .proposal .client-grid { grid-template-columns: 1fr !important; }
    .proposal .header-meta { gap: 1rem !important; }
    .proposal .summary-total { align-items: flex-start !important; flex-direction: column !important; }
  }
`;

function immersiveDocument(html: string, frameId: string): string {
  const resizeScript = `
    <script>
      (() => {
        const sendHeight = () => {
          const height = Math.max(
            document.documentElement.scrollHeight,
            document.body ? document.body.scrollHeight : 0
          );
          parent.postMessage({ type: "proposal-preview-height", frameId: ${JSON.stringify(frameId)}, height }, "*");
        };
        addEventListener("load", sendHeight);
        new ResizeObserver(sendHeight).observe(document.documentElement);
        sendHeight();
      })();
    </script>
  `;

  return `${html}<style>${IMMERSIVE_STYLES}</style>${resizeScript}`;
}

export function ProposalHtmlPreview({
  html,
  className,
  immersive = false,
  title = "Preview",
}: {
  html: string;
  className?: string;
  immersive?: boolean;
  title?: string;
}) {
  const reactId = useId();
  const frameId = `proposal-${reactId}`;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(immersive ? 720 : undefined);

  useEffect(() => {
    if (!immersive) return;

    function updateHeight(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type !== "proposal-preview-height") return;
      if (event.data?.frameId !== frameId) return;
      if (typeof event.data?.height !== "number") return;
      setHeight(Math.max(400, Math.ceil(event.data.height)));
    }

    window.addEventListener("message", updateHeight);
    return () => window.removeEventListener("message", updateHeight);
  }, [frameId, immersive]);

  return (
    <iframe
      ref={frameRef}
      title={title}
      sandbox={
        immersive
          ? "allow-scripts allow-popups allow-popups-to-escape-sandbox"
          : "allow-popups allow-popups-to-escape-sandbox"
      }
      srcDoc={immersive ? immersiveDocument(html, frameId) : html}
      style={immersive ? { height } : undefined}
      className={cn(
        "w-full overflow-hidden bg-white",
        immersive ? "block border-0" : "rounded-md border border-border",
        className
      )}
    />
  );
}
