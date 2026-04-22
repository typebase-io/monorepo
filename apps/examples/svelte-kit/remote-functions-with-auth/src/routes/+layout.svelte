<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { signOut } from './auth/actions.remote';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header class="flex items-center justify-end bg-zinc-50 px-6 py-4 dark:bg-black">
	{#if data.user}
		<div class="flex items-center gap-3">
			<span class="text-sm text-zinc-600 dark:text-zinc-400"
				>{data.user.name || data.user.email}</span
			>
			<form {...signOut}>
				<button
					type="submit"
					disabled={signOut.pending !== 0}
					class="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
				>
					Sign out
				</button>
			</form>
		</div>
	{:else}
		<a
			href="/auth"
			class="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
		>
			Sign in
		</a>
	{/if}
</header>

{@render children()}
