import { createAuthClient } from 'typebase-io/client/auth/vue';

export default defineNuxtPlugin(() => {
  const authClient = createAuthClient();

  return {
    provide: {
      auth: authClient,
    },
  };
});
