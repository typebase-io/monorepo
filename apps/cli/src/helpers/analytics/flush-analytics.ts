import { postHogClient } from '#helpers/analytics/posthog-client.ts';

export const flushAnalytics = async (timeoutMs: number) => {
  let timer: NodeJS.Timeout | undefined;

  await Promise.race([
    postHogClient.flush().catch(() => undefined),
    new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);

  clearTimeout(timer);
};
