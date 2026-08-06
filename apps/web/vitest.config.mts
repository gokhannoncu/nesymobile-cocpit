import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/lib/**/*.test.ts',
      'src/data/product/**/*.test.ts',
      'src/app/**/*.test.ts',
      // Phase 6 route/navigation/legacy guards live here. Without this glob the
      // suites exist but never run, so their guarantees are not enforced.
      'src/test/**/*.test.ts',
    ],

  },
})
