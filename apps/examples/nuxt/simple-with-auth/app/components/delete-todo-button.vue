<script setup lang="ts">
const { $client } = useNuxtApp();

const props = defineProps<{
  id: number;
}>();

const loading = ref(false);

const deleteTodo = async () => {
  loading.value = true;

  await $client.mutations.todos.deleteTodo({ id: props.id });
  await refreshNuxtData('todos');

  loading.value = false;
};
</script>

<template>
  <button type="button" @click="deleteTodo" :disabled="loading" class="text-zinc-400 dark:text-zinc-500 text-xl enabled:cursor-pointer">
    {{ loading ? '⏳' : '❌' }}
  </button>
</template>
