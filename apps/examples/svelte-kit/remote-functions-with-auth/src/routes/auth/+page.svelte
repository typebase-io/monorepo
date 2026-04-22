<script lang="ts">
	import { signIn, signUp } from './actions.remote';

	let mode = $state<'signin' | 'signup'>('signin');
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

			{#if mode === 'signin'}
				<form class="space-y-4" {...signIn}>
					<input
						{...signIn.fields.email.as('email')}
						required
						placeholder="Email"
						autocomplete="email"
						class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
					/>

					<input
						{...signIn.fields.password.as('password')}
						placeholder="Password"
						required
						minLength={8}
						autocomplete="current-password"
						class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
					/>

					{#if signIn.fields.allIssues()?.length}
						{@const issues = signIn.fields
							.allIssues()
							?.map(({ message }) => message)
							.join(', ')}

						<p class="text-sm text-red-500 dark:text-red-400">{issues}</p>
					{/if}

					<button
						type="submit"
						disabled={signIn.pending !== 0}
						class="w-full cursor-pointer rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
					>
						{signIn.pending !== 0 ? 'Loading...' : 'Sign in'}
					</button>
				</form>
			{:else}
				<form class="space-y-4" {...signUp}>
					<input
						{...signUp.fields.name.as('text')}
						placeholder="Name"
						required
						class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
					/>

					<input
						{...signUp.fields.email.as('email')}
						required
						placeholder="Email"
						autocomplete="email"
						class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
					/>

					<input
						{...signUp.fields.password.as('password')}
						placeholder="Password"
						required
						minLength={8}
						autocomplete="current-password"
						class="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
					/>

					{#if signUp.fields.allIssues()?.length}
						{@const issues = signUp.fields
							.allIssues()
							?.map(({ message }) => message)
							.join(', ')}

						<p class="text-sm text-red-500 dark:text-red-400">{issues}</p>
					{/if}

					<button
						type="submit"
						disabled={signUp.pending !== 0}
						class="w-full cursor-pointer rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
					>
						{signUp.pending !== 0 ? 'Loading...' : 'Sign up'}
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
