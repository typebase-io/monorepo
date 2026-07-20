import { readFile } from 'node:fs/promises';
import path from 'path';

import { parse } from 'yaml';

export const loadCatalog = async (monorepoRoot: string): Promise<Record<string, string>> => {
  const workspaceConfig = parse(await readFile(path.join(monorepoRoot, 'pnpm-workspace.yaml'), 'utf-8')) as { catalog?: Record<string, string> };

  return workspaceConfig.catalog ?? {};
};

export const resolveCatalogVersions = (dependencies: Record<string, string>, catalog: Record<string, string>): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(dependencies).map(([name, version]) => {
      if (version !== 'catalog:') {
        return [name, version];
      }

      const catalogVersion = catalog[name];

      if (!catalogVersion) {
        throw new Error(`Dependency "${name}" uses "catalog:" but has no entry in the pnpm-workspace.yaml catalog`);
      }

      return [name, catalogVersion];
    })
  );
};
