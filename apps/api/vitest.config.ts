import { defineConfig } from 'vitest/config';

export default defineConfig({
  // DB tests rebuild indexes after dropping the database, which can be slow.
  test: { testTimeout: 30_000, hookTimeout: 30_000, env: { LOG_LEVEL: 'fatal' } },
});
