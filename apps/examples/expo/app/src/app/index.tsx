import { StatusBar } from 'expo-status-bar';
import { Button, RefreshControl, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Stack } from 'expo-router';

import TodosSkeleton from '../components/todos-skeleton';
import { client } from '../lib/typebase/client/client';
import Todos from '../components/todos';
import { useRefreshByUser } from '../hooks/use-refresh-by-user';

export default function App() {
  const { data, refetch } = useQuery(client.queries.todos.getMany.queryOptions());
  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);

  return (
    <>
      <StatusBar style="dark" />

      <Stack.Screen
        options={{
          headerLargeTitle: true,
          title: 'Todo App',
          headerTitleStyle: {
            color: '#18181b',
          },
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
