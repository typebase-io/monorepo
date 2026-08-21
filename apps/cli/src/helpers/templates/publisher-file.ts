import { type PublisherProvider } from '#helpers/constants.ts';

const PROVIDER_RESOURCES: Record<PublisherProvider, { imports: (ext: 'ts' | 'js') => string[]; resources: string }> = {
  db: { imports: (ext) => [`import { db } from "./db/index.${ext}";`], resources: '{ db }' },
};

export const publisherFileTemplate = ({
  config,
  imports,
  provider,
  ts,
}: {
  config: string;
  imports: string[];
  provider: PublisherProvider;
  ts: boolean;
}) => {
  const { imports: resourceImports, resources } = PROVIDER_RESOURCES[provider];

  const lines = ['import { createPublisher } from "typebase-io/server";', ...resourceImports(ts ? 'ts' : 'js'), ...imports, ''];

  lines.push(`export const publisher = createPublisher(${config}, ${resources});`);

  return lines.join('\n');
};
