<script setup lang="ts">
const { $client } = useNuxtApp();

const props = defineProps<{
  id: number;
  completed: boolean;
}>();

const loading = ref(false);

const toggleTodo = async () => {
  loading.value = true;

  await $client.mutations.todos.toggle({ id: props.id });
  await refreshNuxtData('todos');

  loading.value = false;
};
</script>

<template>
  <button type="button" @click="toggleTodo" :disabled="loading" class="items-center justify-center flex enabled:cursor-pointer">
    <input
      type="checkbox"
      :disabled="loading"
      :checked="props.completed"
      readOnly
      :tabIndex="-1"
      class="h-4 w-4 accent-zinc-900 dark:accent-zinc-50 pointer-events-none disabled:opacity-50"
    />
  </button>
</template>
