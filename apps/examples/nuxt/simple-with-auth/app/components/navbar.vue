<script setup lang="ts">
const { $auth } = useNuxtApp();

const session = $auth.useSession();

const loading = ref(false);

const handleSignOut = async () => {
  loading.value = true;

  await $auth.signOut();

  reloadNuxtApp({ path: '/auth' });
};
</script>

<template>
  <header class="flex items-center justify-end bg-zinc-50 px-6 py-4 dark:bg-black">
    <div v-if="session.isPending || session.error" class="h-7.5 w-full"></div>

    <template v-else-if="session.data">
      <div class="flex items-center gap-3">
        <span class="text-sm text-zinc-600 dark:text-zinc-400">
          {{ session.data.user.name || session.data.user.email }}
        </span>

        <button
          type="button"
          @click="handleSignOut"
          :disabled="loading"
          class="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    </template>

    <template v-else>
      <NuxtLink
        to="/auth"
        class="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 h-7.5"
      >
        Sign in
      </NuxtLink>
    </template>
  </header>
</template>
