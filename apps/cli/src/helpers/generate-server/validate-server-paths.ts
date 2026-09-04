import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';

export const validateServerPaths = ({ actionsPath, authPath }: { actionsPath: string; authPath: string }) => {
  const actions = normalizeServerPath(actionsPath);
  const auth = normalizeServerPath(authPath);

  if (actions === auth || actions.startsWith(`${auth}/`)) {
    throw new Error(
      `Refusing to generate an embedded server that serves auth at \`${authPath}\` and actions at \`${actionsPath}\`: the generated server matches the auth path before your actions, so every action request would be answered by auth and never reach them. Serve auth at a path that does not contain the actions path.`
    );
  }
};
