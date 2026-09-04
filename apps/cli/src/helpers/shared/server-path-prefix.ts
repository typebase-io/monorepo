import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';

export const serverPathPrefix = (serverPath: string) => normalizeServerPath(serverPath) || '/';
