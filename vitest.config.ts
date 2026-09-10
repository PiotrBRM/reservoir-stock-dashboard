import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: the app config pulls in the React
// plugin and the rolldown-vite override, neither of which the pure-logic
// tests in src/lib need. Keeping this minimal avoids coupling test runs to
// the app's (experimental) build tooling.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
