<ul class="space-y-2">
	{#each { length: 5 }, idx}
		<li
			class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div class="flex w-full items-center gap-3">
				<div class="h-4 w-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700"></div>
				<div
					class="h-4 flex-1 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700"
					style={`max-width: ${50 + ((idx * 17) % 40)}%`}
				></div>
			</div>
			<div class="flex h-9 w-5 items-center justify-center">
				<div class="h-5 w-5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700"></div>
			</div>
		</li>
	{/each}
</ul>

<p class="mt-4 h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700"></p>
