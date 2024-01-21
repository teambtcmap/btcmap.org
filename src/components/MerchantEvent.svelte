<script lang="ts">
	import { Tip } from '$lib/comp';
	import type { EventType, User } from '$lib/types';
	import Time from 'svelte-time';

	export let action: EventType;
	export let user: User | undefined;
	export let time: string;
	export let latest: boolean;

	$: profile = user && user['osm_json'];
	$: regexMatch = profile && profile.description.match('(lightning:[^)]+)');
	$: lightning = regexMatch && regexMatch[0].slice(10);

	$: username = profile && profile['display_name'];
</script>

<div
	class="items-center space-y-2 p-5 text-center text-xl lg:flex lg:space-x-5 lg:space-y-0 lg:text-left"
>
	<!-- dot -->
	<span class="relative mx-auto mb-2 flex h-3 w-3 lg:mx-0 lg:mb-0">
		<span
			class="{latest
				? 'animate-ping'
				: ''} absolute inline-flex h-full w-full rounded-full {action === 'create'
				? 'bg-created'
				: action === 'delete'
					? 'bg-deleted'
					: 'bg-link'} opacity-75"
		/>
		<span
			class="relative inline-flex h-3 w-3 rounded-full {action === 'create'
				? 'bg-created'
				: action === 'delete'
					? 'bg-deleted'
					: 'bg-link'}"
		/>
	</span>

	<div class="w-full flex-wrap items-center justify-between space-y-2 lg:flex lg:space-y-0">
		<!-- event information -->
		<div class="space-y-2 lg:space-y-0">
			<span class="text-primary dark:text-white lg:mr-5">
				<!-- action -->
				<strong>{action.charAt(0).toUpperCase() + action.slice(1, action.length)}d</strong>

				<!-- user -->
				{#if user && username}
					by <a
						href="/tagger/{user.id}"
						class="block break-all text-link transition-colors hover:text-hover lg:inline"
						>{username}
					</a>
				{/if}
			</span>

			<!-- time ago -->
			<span
				class="block text-center font-semibold text-taggerTime lg:inline {lightning
					? 'lg:mr-5'
					: ''}"
			>
				<Time live={3000} relative timestamp={time} />
			</span>
		</div>

		<!-- lightning tip button -->
		{#if lightning}
			<Tip destination={lightning} style="block lg:inline mx-auto lg:mx-0" />
		{/if}
	</div>
</div>
