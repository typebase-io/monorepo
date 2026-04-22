<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/typebase/client/auth-client';

	let mode = $state<'signin' | 'signup'>('signin');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isLoading = $state(false);

	const handleSubmit = async (
		evt: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }
	) => {
		try {
			evt.preventDefault();

			error = '';
			isLoading = true;

			const response =
				mode === 'signin'
					? await authClient.signIn.email({
							email,
							password
						})
					: await authClient.signUp.email({
							name,
							email,
							password
						});

			if (response.error) {
				error = response.error.message ?? '';
				isLoading = false;
				return;
			}

			goto('/');
		} catch (err) {
			error = 'Unknown error';
			isLoading = false;
		}
	};
</script>

<div class="flex flex-1 items-start justify-center bg-zinc-50 px-4 pt-24 dark:bg-black">
	<div class="flex w-full max-w-lg flex-col items-center">
		<h1 class="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-50">Welcome</h1>
		<div class="w-full max-w-sm">
			<div class="mb-6 flex rounded-lg border border-zinc-200 dark:border-zinc-800">
				<button
					type="button"
					onclick={() => {
						mode = 'signin';
					}}
					class={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
						mode === 'signin'
							? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
							: 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
					}`}
				>
					Sign in
				</button>
				<button
					type="button"
					onclick={() => {
						mode = 'signup';
					}}
					class={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
						mode === 'signup'
							? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
							: 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
					}`}
				>
					Sign up
				</button>
			</div>

			<form class="space-y-4" onsubmit={handleSubmit}>
				{#if mode === 'signup'}
					<input
						bind:value={name}
						disabled={isLoading}
						placeholder="Name"
						required
						class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
					/>
				{/if}

				<input
					bind:value={email}
					disabled={isLoading}
					required
					placeholder="Email"
					autocomplete="email"
					type="email"
					class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
				/>

				<input
					bind:value={password}
					disabled={isLoading}
					placeholder="Password"
					required
					minLength={8}
					autocomplete="current-password"
					type="password"
					class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
				/>

				{#if error}
					<p class="text-sm text-red-500 dark:text-red-400">{error}</p>
				{/if}

				<button
					type="submit"
					disabled={isLoading}
					class="w-full cursor-pointer rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
				>
					{isLoading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
				</button>
			</form>
		</div>
	</div>
</div>
