import { printMessage } from '#helpers/logs/cloudflare/print-message.ts';

const TRACE_VERSION = 'trace-v1';

export const listenUntilClosed = ({ url, signal }: { url: string; signal: AbortSignal }): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url, TRACE_VERSION);

    socket.binaryType = 'arraybuffer';

    const settle = (callback: () => void) => {
      signal.removeEventListener('abort', onAbort);
      callback();
    };

    function onAbort() {
      socket.close();
      settle(resolve);
    }

    signal.addEventListener('abort', onAbort, { once: true });

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ debug: false }));
    });

    socket.addEventListener('message', (event) => {
      printMessage(event.data as string | ArrayBuffer);
    });

    socket.addEventListener('error', () => {
      if (signal.aborted) {
        return;
      }

      settle(() => {
        reject(new Error('The Cloudflare tail connection failed.'));
      });
    });

    socket.addEventListener('close', () => {
      settle(resolve);
    });
  });
