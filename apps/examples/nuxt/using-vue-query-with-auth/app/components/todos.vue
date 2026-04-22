<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';

const { $client } = useNuxtApp();

const { data, suspense } = useQuery($client.queries.todos.getMany.queryOptions());

const remainingTodos = computed(() => data.value?.filter((t) => !t.completed) || []);

onServerPrefetch(async () => {
  await suspense();
});
</script>

<template>
  <p v-if="data?.length === 0" class="text-center text-zinc-400 dark:text-zinc-500">No todos yet. Add one above!</p>

  <ul v-else class="space-y-2">
    <li
      v-for="todo in data"
      :key="todo.id"
      class="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <ToggleTodoButton :id="todo.id" :completed="todo.completed" />

      <span :class="['flex-1', todo.completed ? 'text-zinc-400 line-through dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-50']">
        <div class="flex flex-col">
          <p>{{ todo.value }}</p>
          <p class="text-sm text-zinc-400 dark:text-zinc-600">
            {{ todo.createdAt.toISOString().split('T')[0] }}
          </p>
        </div>
      </span>

      <DeleteTodoButton :id="todo.id" />
    </li>
  </ul>

  <p v-if="data && data?.length > 0" class="mt-4 text-sm text-zinc-400 dark:text-zinc-500">{{ remainingTodos.length }} remaining</p>
</template>
