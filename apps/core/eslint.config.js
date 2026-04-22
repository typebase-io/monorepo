import { defineConfig } from 'eslint/config';

import baseConfig from '../../eslint.config.js';

export default defineConfig(...baseConfig, {
  rules: {
    'import-x/order': [
      'error',
      {
        pathGroups: [
          {
            pattern: '#client/**',
            group: 'external',
            position: 'after',
          },
          {
            pattern: '#db/**',
            group: 'external',
            position: 'after',
          },
          {
            pattern: '#server/**',
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
