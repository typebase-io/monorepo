import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { Wordmark } from '#components/brand.tsx';

export const gitConfig = {
  user: 'typebase-io',
  repo: 'monorepo',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Wordmark size="small" />,
    },
    themeSwitch: {
      enabled: false,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
