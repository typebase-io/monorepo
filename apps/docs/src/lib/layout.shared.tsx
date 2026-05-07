import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

export const gitConfig = {
  user: 'typebase-io',
  repo: 'monorepo',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-x-3">
          <Image src="/logo.svg" alt="Typebase" width={1454} height={1959} className="h-8.5 w-auto" />
          <span className="font-semibold text-fd-foreground text-lg">Typebase</span>
        </div>
      ),
    },
    themeSwitch: {
      enabled: false,
    },
    links: [
      {
        text: 'Documentation',
        url: '/docs',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
