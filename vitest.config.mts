import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: "react-jsx",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
