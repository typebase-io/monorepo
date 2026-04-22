import { useMutation } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, TextInput, View } from 'react-native';

import { client } from '../../lib/typebase/client/client';
import { queryClient } from '../../lib/tanstack-query/query-client';

export default function AddTodoScreen() {
  const router = useRouter();
  const [value, setValue] = useState('');

  const addTodo = useMutation(
    client.mutations.todos.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: client.queries.todos.key(),
        });

        setValue('');
        router.back();
      },
    })
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: 'minimal',
          title: 'Add todo',
        }}
      />

      <View className="flex-1 items-start justify-start px-4">
        <View className="flex-col gap-2 w-full mt-10">
          <TextInput
            value={value}
            onChangeText={(e) => setValue(e)}
            editable={!addTodo.isPending}
            placeholder="What needs to be done?"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 disabled:opacity-50"
          />

          <Button title="Add" disabled={addTodo.isPending || !value.trim()} onPress={() => addTodo.mutate({ value: value.trim() })} />
        </View>
      </View>
    </>
  );
}
