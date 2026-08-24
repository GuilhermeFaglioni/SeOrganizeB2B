"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const IMMERSIVE_STYLES = `
  :root { color-scheme: light; }
  html,
  body,
  body > .proposal,
  .proposal {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  html, body { background: #ffffff !important; }
  body { margin: 0 !important; }
  .proposal {
    max-width: none !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  .proposal > header,
  .proposal > .header,
  .proposal > main,
  .proposal > .body,
  .proposal > footer,
  .proposal > .footer,
  body > header,
  body > .header,
  body > main,
  body > .body,
  body > footer,
  body > .footer {
    position: static !important;
    inset: auto !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
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

export function buildImmersiveProposalDocument(html: string, frameId: string): string {
  const resizeScript = `
    <script>
      (() => {
        let lastHeight = 0;
        let frame;
        const sendHeight = () => {
          const root = document.documentElement;
          const body = document.body;
          const height = Math.ceil(Math.max(
            root ? root.scrollHeight : 0,
            root ? root.offsetHeight : 0,
            body ? body.scrollHeight : 0,
            body ? body.offsetHeight : 0,
            body ? body.getBoundingClientRect().height : 0
          ));
          if (height <= 0 || height === lastHeight) return;
          lastHeight = height;
          parent.postMessage({ type: "proposal-preview-height", frameId: ${JSON.stringify(frameId)}, height }, "*");
        };
        const scheduleHeight = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(sendHeight);
        };
        addEventListener("load", scheduleHeight);
        addEventListener("resize", scheduleHeight);
        const observer = new ResizeObserver(scheduleHeight);
        if (document.documentElement) observer.observe(document.documentElement);
        if (document.body) observer.observe(document.body);
        document.querySelectorAll("img").forEach((image) => image.addEventListener("load", scheduleHeight, { once: true }));
        if (document.fonts?.ready) document.fonts.ready.then(scheduleHeight);
        scheduleHeight();
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
      srcDoc={immersive ? buildImmersiveProposalDocument(html, frameId) : html}
      style={immersive ? { height } : undefined}
      className={cn(
        "w-full bg-white",
        immersive ? "block border-0" : "overflow-hidden rounded-md border border-border",
        className
      )}
    />
  );
}
