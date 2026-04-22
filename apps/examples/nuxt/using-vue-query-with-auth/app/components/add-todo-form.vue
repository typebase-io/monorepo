<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';

const { $client } = useNuxtApp();
const queryClient = useQueryClient();

const value = ref('');

const { mutate, isPending } = useMutation(
  $client.mutations.todos.create.mutationOptions({
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: $client.queries.todos.key() });
      value.value = '';
    },
  })
);
</script>

<template>
  <form class="flex gap-2 mb-8" @submit.prevent="() => mutate({ value })">
    <input
      type="text"
      v-model="value"
      name="value"
      :disabled="isPending"
      placeholder="What needs to be done?"
      class="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400 disabled:opacity-50"
    />

    <button
      type="submit"
      :disabled="isPending || value.trim() === ''"
      class="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors enabled:hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:enabled:hover:bg-zinc-300 enabled:cursor-pointer disabled:opacity-50"
    >
      Add
    </button>
  </form>
</template>
