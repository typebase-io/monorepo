import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';
import { authPathExpressions } from '#helpers/templates/server-file/auth-path-expressions.ts';

export const authPathCondition = (authPath: string | { fromAuth: true }) => {
  const basePath =
    typeof authPath === 'string' ? JSON.stringify(normalizeServerPath(authPath)) : `${authPathExpressions(authPath).path}.replace(/\\/+$/, "")`;

  return `pathname === ${basePath} || pathname.startsWith(${basePath} + "/")`;
};
