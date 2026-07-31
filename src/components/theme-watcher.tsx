"use client";

import { useEffect } from "react";

export function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const stored = localStorage.getItem("theme");
      if (stored) return; // user manually chose a theme, don't override
      document.documentElement.classList.toggle("dark", e.matches);
    };

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  return null;
}
