"use client";

import { motion, useReducedMotion } from "motion/react";

export function AnimatedPage({
  children,
  pageKey,
}: {
  children: React.ReactNode;
  pageKey: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      key={pageKey}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
      className="h-full min-h-0"
    >
      {children}
    </motion.div>
  );
}
