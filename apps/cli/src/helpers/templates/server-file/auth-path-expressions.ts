import { DEFAULT_AUTH_PATH } from '#helpers/constants.ts';
import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';

export const authPathExpressions = (authPath: string | { fromAuth: true }) => {
  const path = typeof authPath === 'string' ? JSON.stringify(authPath) : `(auth.options.basePath || ${JSON.stringify(DEFAULT_AUTH_PATH)})`;

  return {
    path,
    wildcard: typeof authPath === 'string' ? JSON.stringify(`${normalizeServerPath(authPath)}/*`) : `${path}.replace(/\\/+$/, "") + "/*"`,
  };
};
