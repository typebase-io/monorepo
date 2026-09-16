import { createServer } from 'node:net';

export const freePort = async (): Promise<number> => {
  const socket = createServer();

  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });

  const address = socket.address();

  await new Promise<void>((resolve) => {
    socket.close(() => {
      resolve();
    });
  });

  if (address === null || typeof address === 'string') {
    throw new Error('Could not reserve a free local port.');
  }

  return address.port;
};
