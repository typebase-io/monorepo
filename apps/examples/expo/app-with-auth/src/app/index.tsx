import { ActivityIndicator, View } from 'react-native';
import { authClient } from '../lib/typebase/client/auth-client';
import { Redirect, Stack } from 'expo-router';

export default function IndexScreen() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (session) {
    return <Redirect href="/(authed)/" />;
  }

  return <Redirect href="/(un-authed)/" />;
}
