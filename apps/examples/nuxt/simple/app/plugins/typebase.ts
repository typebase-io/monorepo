import { createRouterClient } from 'typebase-io/client';
import type { Router } from '~/utils/typebase/_generated/server';

export default defineNuxtPlugin(() => {
  const event = useRequestEvent();
  const runtimeConfig = useRuntimeConfig();

  const client = createRouterClient<Router>({
    url: runtimeConfig.public.TYPEBASE_APP_URL,
    headers: event?.headers,
  });

  return {
    provide: {
      client,
    },
  };
});
