<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/typebase/client/auth-client';

	const session = authClient.useSession();

	const handleSignOut = async () => {
		await authClient.signOut();
		goto('/auth');
	};
</script>

{#if $session.isPending || $session.error}
	<div class="h-7.5 w-full"></div>
{:else if $session.data?.user}
	<div class="flex items-center gap-3">
		<span class="text-sm text-zinc-600 dark:text-zinc-400"
			>{$session.data.user.name || $session.data.user.email}</span
		>

		<button
			type="button"
			class="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
			onclick={handleSignOut}
		>
			Sign out
		</button>
	</div>
{:else}
	<a
		href="/auth"
		class="h-7.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
	>
		Sign in
	</a>
{/if}
