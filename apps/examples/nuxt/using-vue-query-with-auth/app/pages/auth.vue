<script setup lang="ts">
const { $auth } = useNuxtApp();

const mode = ref<'signin' | 'signup'>('signin');
const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const handleSubmit = async (e: Event) => {
  e.preventDefault();

  error.value = '';
  loading.value = true;

  try {
    if (mode.value === 'signup') {
      const { error: signUpError } = await $auth.signUp.email({
        email: email.value,
        password: password.value,
        name: name.value,
      });

      if (signUpError) {
        error.value = signUpError.message || 'Sign up failed';
        loading.value = false;
        return;
      }
    } else {
      const { error: signInError } = await $auth.signIn.email({
        email: email.value,
        password: password.value,
      });

      if (signInError) {
        error.value = signInError.message || 'Sign in failed';
        loading.value = false;
        return;
      }
    }

    reloadNuxtApp({ path: '/' });
  } catch {
    error.value = 'Something went wrong';
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex flex-1 items-start justify-center bg-zinc-50 px-4 pt-24 dark:bg-black">
    <div class="flex w-full max-w-lg flex-col items-center">
      <h1 class="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-50">Welcome</h1>

      <div class="w-full max-w-sm">
        <div class="mb-6 flex rounded-lg border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            @click="mode = 'signin'"
            :class="[
              'flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              mode === 'signin'
                ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
            ]"
          >
            Sign in
          </button>
          <button
            type="button"
            @click="mode = 'signup'"
            :class="[
              'flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              mode === 'signup'
                ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
            ]"
          >
            Sign up
          </button>
        </div>

        <form class="space-y-4" @submit="handleSubmit">
          <input
            v-if="mode === 'signup'"
            v-model="name"
            type="text"
            placeholder="Name"
            required
            class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
          />

          <input
            v-model="email"
            type="email"
            placeholder="Email"
            required
            autocomplete="email"
            class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
          />

          <input
            v-model="password"
            type="password"
            placeholder="Password"
            required
            minlength="8"
            autocomplete="current-password"
            class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
          />

          <p v-if="error" class="text-sm text-red-500 dark:text-red-400">
            {{ error }}
          </p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full cursor-pointer rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {{ loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Sign up' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
