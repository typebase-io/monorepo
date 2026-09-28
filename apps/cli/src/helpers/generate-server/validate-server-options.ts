import { type ServerAdapter, type ServerMode } from '#helpers/constants.ts';

export const validateServerOptions = ({
  mode,
  adapter,
  options,
}: {
  mode: ServerMode;
  adapter: ServerAdapter;
  options: { actionsPath?: string; authPath?: string; storagePath?: string; localStorage?: boolean; port?: number };
}) => {
  if (mode === 'standalone') {
    for (const [flag, value] of [
      ['--actions-path', options.actionsPath],
      ['--auth-path', options.authPath],
      ['--storage-path', options.storagePath],
    ] as const) {
      if (value !== undefined) {
        throw new Error(
          `Refusing to generate a standalone server with \`${flag}\`: a standalone server owns its process and always serves the paths it was built with, so nothing would use it. Drop \`${flag}\`, or generate an embedded server with \`--embedded\`.`
        );
      }
    }
  }

  if (mode === 'embedded' && options.port !== undefined) {
    throw new Error(
      'Refusing to generate an embedded server with `--port`: an embedded server is mounted by your application and never listens, so nothing would use it. Drop `--port`, or generate a standalone server.'
    );
  }

  if (options.storagePath !== undefined && !options.localStorage) {
    throw new Error(
      'Refusing to generate a server with `--storage-path` but no `--local-storage`: only local storage serves files from the generated server, so nothing would use the path. Drop `--storage-path`, or add `--local-storage`.'
    );
  }

  if (options.localStorage && adapter === 'cloudflare') {
    throw new Error(
      'Refusing to generate a Cloudflare server with `--local-storage`: local storage keeps files on disk, and a Worker has no disk to keep them on. Drop `--local-storage`, or choose another `--adapter`.'
    );
  }
};
