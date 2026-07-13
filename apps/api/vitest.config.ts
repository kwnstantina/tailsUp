import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    // Phase 3b: provide the now-required AUTH_SECRET before any test imports
    // app.ts (which loads config.ts). Auth itself is mocked per-file.
    setupFiles: ['./src/test/setup.ts'],
    // Treat unhandled promise rejections as test failures.
    dangerouslyIgnoreUnhandledErrors: false,
    // Isolate each test file so module-level side-effects (config reads) do
    // not bleed across files.
    isolate: true,
    // Allow vi.mock() hoisting to work correctly with ESM.
    globals: false,
  },
  resolve: {
    alias: {
      // Mirror the root tsconfig.base.json path alias so @tailsup/shared
      // resolves to the TypeScript source without a build step.
      '@tailsup/shared': resolve(root, 'packages/shared/src/index.ts'),
    },
  },
});
