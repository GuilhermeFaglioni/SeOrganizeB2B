export const APP_NAME = "SeOrganize+";

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const TOPBAR_HEIGHT = 56;

export const DEFAULT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const AREA_COLORS: Record<string, string> = {
  Sales: "#3b82f6",
  Engineering: "#10b981",
  Marketing: "#f97316",
  Design: "#ec4899",
  Operations: "#8b5cf6",
};

export const PRIORITY_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  urgent: { text: "#991b1b", bg: "#fee2e2", dot: "#dc2626" },
  high: { text: "#dc2626", bg: "#fef2f2", dot: "#dc2626" },
  medium: { text: "#d97706", bg: "#fffbeb", dot: "#d97706" },
  low: { text: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" },
};

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  AUTH_ERROR: "AUTH_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
