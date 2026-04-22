import { StatusBar } from 'expo-status-bar';
import { Button, RefreshControl, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Stack } from 'expo-router';

import TodosSkeleton from '../../components/todos-skeleton';
import { client } from '../../lib/typebase/client/client';
import Todos from '../../components/todos';
import { useRefreshByUser } from '../../hooks/use-refresh-by-user';
import { authClient } from '../../lib/typebase/client/auth-client';
import { useState } from 'react';
import { queryClient } from '../../lib/tanstack-query/query-client';

export default function IndexScreen() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data, refetch } = useQuery(client.queries.todos.getMany.queryOptions());
  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);

  const handleLogOut = async () => {
    setIsLoggingOut(true);

    await queryClient.cancelQueries();
    await authClient.signOut();

    queryClient.clear();

    router.replace('/(un-authed)');
  };

  return (
    <>
      <StatusBar style="dark" />
      <Stack.Screen
        options={{
          animation: 'none',
          headerLargeTitle: true,
          title: 'Todo App',
          headerTitleStyle: {
            color: '#18181b',
          },
          headerLeft: () => <Button title="Log out" onPress={handleLogOut} disabled={isLoggingOut} />,
          headerRight: () => (
            <Link href="/add-todo" asChild>
              <Button title="Add" />
            </Link>
          ),
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="pt-2"
        refreshControl={<RefreshControl refreshing={isRefetchingByUser} onRefresh={refetchByUser} />}
      >
        <View className="flex-1 items-start justify-start px-4">{data ? <Todos todos={data} /> : <TodosSkeleton />}</View>
      </ScrollView>
    </>
  );
}
