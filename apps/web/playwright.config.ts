import { defineConfig, devices } from '@playwright/test'

// E2E against the ALREADY-RUNNING local integration stack (SPA :5173, BFF :8000,
// Keycloak :8080). We don't start a webServer here — the stack is external.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
