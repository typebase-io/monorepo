import { type ServerMode } from '#helpers/constants.ts';

export const validateServerOptions = ({
  mode,
  options,
}: {
  mode: ServerMode;
  options: { actionsPath?: string; authPath?: string; port?: number };
}) => {
  if (mode === 'standalone') {
    for (const [flag, value] of [
      ['--actions-path', options.actionsPath],
      ['--auth-path', options.authPath],
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
};
