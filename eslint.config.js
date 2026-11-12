import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * Hexagonal boundaries:
 *   core           → depends on nothing (no framework, no library, no I/O)
 *   infrastructure → depends on core only
 *   apps           → wire core + infrastructure together (composition roots)
 */
const forbid = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: patterns.map((group) => ({ group: [group], message })) }],
})

export default tseslint.config(
  { ignores: ['**/node_modules', '**/.nuxt', '**/.output', '**/dist', '.snapshots', 'packages/video/.cache'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Plain Node scripts.
    files: ['bin/**/*.mjs', 'packages/video/*.mjs', 'packages/video/audio/*.mjs', 'packages/video/lib/*.mjs', 'packages/video/studio/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        WebSocket: 'readonly',
      },
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: forbid(
      ['@repo-motion/infrastructure', 'zod', 'nuxt*', 'h3', 'node:*'],
      'The core is pure: it may not depend on frameworks, SDKs or I/O. Declare a port instead.',
    ),
  },
  {
    files: ['packages/core/src/domain/**/*.ts'],
    rules: forbid(['**/application/**'], 'The domain may not depend on the application layer.'),
  },
  {
    files: ['packages/infrastructure/**/*.ts'],
    rules: forbid(
      ['nuxt*', 'h3', '@repo-motion/web', 'remotion', '@remotion/*', 'react*'],
      'Adapters may not depend on delivery mechanisms, and the video engine runs in its own process.',
    ),
  },
  {
    // The videos are drawn from the job they are given: they know nothing of the application.
    files: ['packages/video/**/*.{ts,tsx}'],
    // The starter is the first draft of a piece: it is copied into a workspace, not built here.
    ignores: ['packages/video/studio/starter/**'],
    rules: forbid(['@repo-motion/*', 'nuxt*', 'h3'], 'The video package only knows its own contract (src/types.ts).'),
  },
)
