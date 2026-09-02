import net from 'node:net';

export const isPortAvailable = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.listen({ port, host: '127.0.0.1', exclusive: true }, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
