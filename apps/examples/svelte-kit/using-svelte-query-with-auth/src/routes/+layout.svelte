<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import type { LayoutProps } from './$types';
	import Navbar from '$lib/components/navbar.svelte';

	let { children, data }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<QueryClientProvider client={data.queryClient}>
	<header class="flex items-center justify-end bg-zinc-50 px-6 py-4 dark:bg-black">
		<Navbar />
	</header>

	{@render children()}
</QueryClientProvider>
