import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    actionTimeout: 0,
    baseURL,
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  ...(process.env.BASE_URL
    ? {}
    : {
        webServer: {
          command: process.env.CI ? 'npm run preview' : 'npm run dev',
          port: process.env.CI ? 4173 : 5173,
          reuseExistingServer: !process.env.CI,
        },
      }),
})
