import { defineConfig } from 'playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: '.',
  testMatch: 'coach-browser.spec.mjs',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:8874', trace: 'retain-on-failure' },
  webServer: {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    command: 'python3 -m http.server 8874 --bind 127.0.0.1 --directory apps/coach',
    url: 'http://127.0.0.1:8874/coach.html',
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
