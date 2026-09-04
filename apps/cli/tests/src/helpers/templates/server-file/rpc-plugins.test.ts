import { describe, expect, it } from 'vitest';

import { rpcPlugins, rpcPluginsImport, setsCorsHeaders } from '#helpers/templates/server-file/rpc-plugins.ts';

describe('rpcPluginsImport', () => {
  it('imports the cross-origin plugin for a standalone server', () => {
    expect(rpcPluginsImport('standalone')).toBe('import { CORSPlugin, RequestHeadersPlugin } from "@orpc/server/plugins";');
  });

  it('imports only the request headers plugin for an embedded server', () => {
    expect(rpcPluginsImport('embedded')).toBe('import { RequestHeadersPlugin } from "@orpc/server/plugins";');
  });
});

describe('rpcPlugins', () => {
  it('registers the cross-origin plugin for a standalone server', () => {
    expect(rpcPlugins('standalone')).toBe(`  plugins: [
    new CORSPlugin({
      origin: (origin, options) => origin,
      allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH'],
    }),
    new RequestHeadersPlugin(),
  ],`);
  });

  it('registers no cross-origin plugin for an embedded server, whose host owns that policy', () => {
    expect(rpcPlugins('embedded')).toBe(`  plugins: [
    new RequestHeadersPlugin(),
  ],`);
  });
});

describe('setsCorsHeaders', () => {
  it('is true for a standalone server, which owns the process nobody else shares', () => {
    expect(setsCorsHeaders('standalone')).toBe(true);
  });

  it('is false for an embedded server, whose host already has a cross-origin policy', () => {
    expect(setsCorsHeaders('embedded')).toBe(false);
  });
});
