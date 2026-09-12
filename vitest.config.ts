import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": `${root.replace(/\\/g, "/")}/src`,
    },
  },
  test: {
    root,
    environment: "node",
    setupFiles: [`${root.replace(/\\/g, "/")}/src/test/setup.ts`],
  },
});
