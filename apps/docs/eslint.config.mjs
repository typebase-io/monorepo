import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

import baseConfig from '../../eslint.config.js';

const nextConfig = nextVitals.filter((config) => config.name !== 'next/typescript');

const eslintConfig = defineConfig([
  ...baseConfig,
  ...nextConfig,
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.source/**']),
]);

export default eslintConfig;
