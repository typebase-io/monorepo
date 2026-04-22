import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { createAuthClient } from 'typebase-io/client/auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_TYPEBASE_APP_URL,
  plugins: [
    expoClient({
      scheme: 'app',
      storagePrefix: 'app',
      storage: SecureStore,
    }),
  ],
});
