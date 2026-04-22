import { Button, Text, View } from 'react-native';
import { Checkbox } from 'expo-checkbox';
import { useMutation } from '@tanstack/react-query';

import { client } from '../lib/typebase/client/client';
import { queryClient } from '../lib/tanstack-query/query-client';

export default function Todos({ todos }: { todos: { id: number; value: string; completed: boolean; createdAt: Date }[] }) {
  const toggleTodo = useMutation(
    client.mutations.todos.toggle.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: client.queries.todos.key(),
        });
      },
    })
  );

  const deleteTodo = useMutation(
    client.mutations.todos.deleteTodo.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: client.queries.todos.key(),
        });
      },
    })
  );

  return (
    <>
      <Text className="mb-4 text-sm text-zinc-400">{todos.filter((t) => !t.completed).length} remaining</Text>

      {todos.length === 0 ? (
        <Text className="text-center text-zinc-400 w-full">No todos yet. Add one above!</Text>
      ) : (
        <View className="gap-2 w-full">
          {todos.map((todo) => (
            <View key={todo.id} className="flex-row items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
              <Checkbox
                className="h-4 w-4 accent-zinc-900 disabled:opacity-50"
                value={todo.completed}
                disabled={toggleTodo.isPending && toggleTodo.variables.id === todo.id}
                onValueChange={() => toggleTodo.mutate({ id: todo.id })}
              />

              <View className="flex-1">
                <View>
                  <Text>{todo.value}</Text>
                  <Text className="text-sm text-zinc-400">{todo.createdAt.toISOString().split('T')[0]}</Text>
                </View>
              </View>

              <Button
                title={deleteTodo.isPending && deleteTodo.variables.id === todo.id ? '⏳' : '❌'}
                disabled={deleteTodo.isPending && deleteTodo.variables.id === todo.id}
                onPress={() => deleteTodo.mutate({ id: todo.id })}
              />
            </View>
          ))}
        </View>
      )}
    </>
  );
}
