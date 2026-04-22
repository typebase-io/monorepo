<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';

const props = defineProps<{
  id: number;
}>();

const { $client } = useNuxtApp();
const queryClient = useQueryClient();

const { mutate, isPending } = useMutation(
  $client.mutations.todos.deleteTodo.mutationOptions({
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: $client.queries.todos.key() });
    },
  })
);
</script>

<template>
  <button
    type="button"
    @click="() => mutate({ id: props.id })"
    :disabled="isPending"
    class="text-zinc-400 dark:text-zinc-500 text-xl enabled:cursor-pointer"
  >
    {{ isPending ? '⏳' : '❌' }}
  </button>
</template>
