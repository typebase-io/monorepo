import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { onAppStateChange, queryClient } from '../lib/tanstack-query/query-client';
import { useOnlineManager } from '../hooks/use-online-manager';
import { useAppState } from '../hooks/use-app-state';

export default function Layout() {
  useOnlineManager();
  useAppState(onAppStateChange);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack />
    </QueryClientProvider>
  );
}
