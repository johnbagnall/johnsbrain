import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Use dev mode so we don't fight the `output: "standalone"` config used for Docker.
    command: "npm run db:migrate && next dev -p " + PORT,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      BETTER_AUTH_SECRET: "playwright-test-secret-playwright-test-secret",
      BETTER_AUTH_URL: BASE_URL,
      DATABASE_URL: "file:./data/playwright.db",
    },
  },
});
