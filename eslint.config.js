import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'assets/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        navigator: 'readonly',
        alert: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        unescape: 'readonly',
        escape: 'readonly',
        encodeURIComponent: 'readonly',
        decodeURIComponent: 'readonly',
        process: 'readonly'
      }
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Off by design: call logs, audit entries and credential hashes live in
      // localStorage, so the relevant "state" is a version counter that App
      // bumps after a sync. ESLint cannot see that dependency and reports every
      // one of them as missing or unnecessary.
      'react-hooks/exhaustive-deps': 'off',
      // catch bindings are often intentionally unused when a failure is already
      // handled by a fallback.
      'no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          // Props such as `theme`, `onToggleTheme`, `neonStatus`, `summary` and
          // `currentUser` are accepted but unused in some shared components;
          // the call sites stay explicit rather than varying per component.
          args: 'none'
        }
      ],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
];