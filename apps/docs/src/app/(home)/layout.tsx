import { HomeLayout } from 'fumadocs-ui/layouts/home';

import { baseOptions } from '#lib/layout.shared.tsx';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <HomeLayout
      {...baseOptions()}
      links={[
        {
          text: 'Documentation',
          url: '/docs',
          on: 'all',
        },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
