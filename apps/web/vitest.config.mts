import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/lib/**/*.test.ts',
      'src/data/product/**/*.test.ts',
      'src/app/**/*.test.ts',
    ],

  },
})
