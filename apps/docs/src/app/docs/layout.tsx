import { DocsLayout } from 'fumadocs-ui/layouts/docs';

import { baseOptions } from '#lib/layout.shared.tsx';
import { source } from '#lib/source.ts';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
