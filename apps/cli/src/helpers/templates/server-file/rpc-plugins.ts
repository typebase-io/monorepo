import { type ServerMode } from '#helpers/constants.ts';

export const setsCorsHeaders = (mode: ServerMode) => mode === 'standalone';

export const rpcPluginsImport = (mode: ServerMode) =>
  `import { ${setsCorsHeaders(mode) ? 'CORSPlugin, ' : ''}RequestHeadersPlugin } from "@orpc/server/plugins";`;

export const rpcPlugins = (mode: ServerMode) => `  plugins: [
${
  setsCorsHeaders(mode)
    ? `    new CORSPlugin({
      origin: (origin, options) => origin,
      allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH'],
    }),
`
    : ''
}    new RequestHeadersPlugin(),
  ],`;
