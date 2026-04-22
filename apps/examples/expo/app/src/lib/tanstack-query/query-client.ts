import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppStateStatus, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2 } },
});

export const onAppStateChange = (status: AppStateStatus) => {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
};
