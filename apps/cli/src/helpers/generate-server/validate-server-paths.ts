import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';

export const validateServerPaths = ({ actionsPath, authPath, storagePath }: { actionsPath: string; authPath: string; storagePath?: string }) => {
  const actions = normalizeServerPath(actionsPath);
  const auth = normalizeServerPath(authPath);
  const covers = (outer: string, inner: string) => inner === outer || inner.startsWith(`${outer}/`);

  if (covers(auth, actions)) {
    throw new Error(
      `Refusing to generate an embedded server that serves auth at \`${authPath}\` and actions at \`${actionsPath}\`: the generated server matches the auth path before your actions, so every action request would be answered by auth and never reach them. Serve auth at a path that does not contain the actions path.`
    );
  }

  if (storagePath === undefined) {
    return;
  }

  const storage = normalizeServerPath(storagePath);

  if (covers(auth, storage)) {
    throw new Error(
      `Refusing to generate an embedded server that serves auth at \`${authPath}\` and local storage at \`${storagePath}\`: the generated server matches the auth path before local storage, so every file request would be answered by auth. Serve local storage at a path outside the auth path.`
    );
  }

  if (covers(storage, actions)) {
    throw new Error(
      `Refusing to generate an embedded server that serves local storage at \`${storagePath}\` and actions at \`${actionsPath}\`: the generated server matches the storage path before your actions, so every action request would be answered by local storage. Serve local storage at a path that does not contain the actions path.`
    );
  }
};
