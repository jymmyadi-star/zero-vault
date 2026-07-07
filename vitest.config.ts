import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'server/__tests__/**/*.test.ts', 'lib/**/__tests__/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      'react-native-quick-crypto': path.resolve(__dirname, 'tests/mocks/quick-crypto.mock'),
    },
  },
});
