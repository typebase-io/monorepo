<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';

const props = defineProps<{
  id: number;
  completed: boolean;
}>();

const { $client } = useNuxtApp();
const queryClient = useQueryClient();

const { mutate, isPending } = useMutation(
  $client.mutations.todos.toggle.mutationOptions({
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: $client.queries.todos.key() });
    },
  })
);
</script>

<template>
  <button type="button" @click="() => mutate({ id: props.id })" :disabled="isPending" class="items-center justify-center flex enabled:cursor-pointer">
    <input
      type="checkbox"
      :disabled="isPending"
      :checked="props.completed"
      readOnly
      :tabIndex="-1"
      class="h-4 w-4 accent-zinc-900 dark:accent-zinc-50 pointer-events-none disabled:opacity-50"
    />
  </button>
</template>
