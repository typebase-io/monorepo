import { proxyToTypebase } from 'typebase-io/client/auth/nuxt';

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/auth') && !event.path.startsWith('/rpc')) {
    return;
  }

  const runtimeConfig = useRuntimeConfig();

  return proxyToTypebase(event, runtimeConfig.public.TYPEBASE_APP_URL);
});
