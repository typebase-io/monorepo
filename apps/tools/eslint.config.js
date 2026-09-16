import { defineConfig } from 'eslint/config';

import baseConfig from '../../eslint.config.js';

export default defineConfig(...baseConfig, {
  settings: {
    'import-x/ignore': ['playwright'],
  },
  rules: {
    'import-x/order': [
      'error',
      {
        pathGroups: [
          {
            pattern: '#commands/**',
            group: 'external',
            position: 'after',
          },
          {
            pattern: '#helpers/**',
            group: 'external',
            position: 'after',
          },
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
  },
});
