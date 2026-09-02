import net from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { isPortAvailable } from '#helpers/start/is-port-available.ts';

describe('isPortAvailable', () => {
  const servers: net.Server[] = [];

  const close = (server: net.Server) =>
    new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });

  const listen = (port = 0): Promise<{ server: net.Server; port: number }> =>
    new Promise((resolve, reject) => {
      const server = net.createServer();

      servers.push(server);

      server.once('error', reject);

      server.listen(port, '127.0.0.1', () => {
        const address = server.address();

        if (address === null || typeof address === 'string') {
          reject(new Error('Could not read the port the test server is listening on.'));

          return;
        }

        resolve({ server, port: address.port });
      });
    });

  const freePort = async (): Promise<number> => {
    const { server, port } = await listen();

    await close(server);

    return port;
  };

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(close));
  });

  it('reports a port nothing is listening on as available', async () => {
    await expect(isPortAvailable(await freePort())).resolves.toBe(true);
  });

  it('reports a port something is already listening on as unavailable', async () => {
    const { port } = await listen();

    await expect(isPortAvailable(port)).resolves.toBe(false);
  });

  it('leaves the port free for the server to bind afterwards', async () => {
    const port = await freePort();

    await expect(isPortAvailable(port)).resolves.toBe(true);
    await expect(listen(port)).resolves.toEqual(expect.objectContaining({ port }));
  });
});
