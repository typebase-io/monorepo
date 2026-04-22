// @ts-check

import tseslint from 'typescript-eslint';

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import { importX } from 'eslint-plugin-import-x';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import prettierPlugin from 'eslint-plugin-prettier/recommended';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  prettierPlugin,
  {
    ignores: ['**/eslint.config.*', '**/prettier.config.*', 'dist'],
  },
  {
    plugins: {
      // @ts-ignore
      'import-x': importX,
    },
    extends: ['import-x/flat/recommended'],
  },
  {
    plugins: {
      'no-relative-import-paths': noRelativeImportPaths,
    },
    rules: {
      'no-relative-import-paths/no-relative-import-paths': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: true,
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/restrict-template-expressions': 'off',
      'sort-imports': [
        'error',
        {
          ignoreCase: false,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: false,
        },
      ],
      'import-x/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  }
);
