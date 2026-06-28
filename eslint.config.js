import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'assets/**',
      'data/**',
      'images/**',
      'favicon.ico',
      'manifest.json',
    ],
  },
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        customElements: true,
        document: true,
        window: true,
        fetch: true,
        setTimeout: true,
        setInterval: true,
        clearTimeout: true,
        TextDecoder: true,
        ReadableStream: true,
        console: true,
        Date: true,
        HTMLElement: true,
        URL: true,
        URLSearchParams: true,
      },
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
    ],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single'],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_|^event' }],
    },
  },
)
