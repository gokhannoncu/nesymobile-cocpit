import { config } from '@nesy/eslint-config/react-internal'

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...config,
  {
    ignores: ['dist/**'],
  },
]
