import { expo } from '@better-auth/expo';
import { defineAuth } from 'typebase-io/server';

export const auth = defineAuth({
  trustedOrigins: ['acme://', 'exp://', 'exp://**', 'exp://192.168.*.*:*/**', 'exp://192.168.*.*:*'],
  plugins: [expo()],
  emailAndPassword: {
    enabled: true,
  },
});
