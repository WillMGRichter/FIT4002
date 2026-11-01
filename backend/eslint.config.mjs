import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    languageOptions: { globals: globals.node },
    rules: {
      // `any` switches the type checker off for everything it touches. Use `unknown`
      // and narrow, or a real type. If a genuine escape hatch is unavoidable (e.g. an
      // untyped third-party library), disable the rule on that line AND say why.
      '@typescript-eslint/no-explicit-any': 'error',

      // A leading underscore marks an intentionally unused binding: an Express
      // error handler must declare all 4 parameters (arity is how Express spots it),
      // and `const { password_hash: _, ...safe } = user` is the idiom for omitting a field.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },

  // Hand-written declarations for untyped third-party libraries legitimately need `any`.
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },

  // Tests build loose fixtures/mocks; strict typing there costs more than it gives.
  {
    files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off', // jest.isolateModules needs require()
    },
  },

  // Plain CommonJS config files at the package root.
  {
    files: ['*.js', '*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
