<script setup lang="ts">
useHead({
  title: 'Todo App',
  meta: [
    {
      name: 'description',
      content: 'A simple todo app built with Nuxt and Typebase',
    },
  ],
  htmlAttrs: {
    class: 'h-full',
  },
  bodyAttrs: {
    class: 'h-full',
  },
});
</script>

<template>
  <NuxtLayout>
    <Navbar />
    <NuxtPage />
  </NuxtLayout>
</template>
