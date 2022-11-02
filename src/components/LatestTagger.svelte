<script>
	import Time from 'svelte-time';
	import { Tip } from '$comp';

	export let location;
	export let action;
	export let user;
	export let time;
	export let latest;
	export let lat;
	export let long;

	$: profile = user['osm_json'] && user['osm_json'];
	$: regexMatch = profile && profile.description.match('(lightning:[^)]+)');
	$: lightning = regexMatch && regexMatch[0].slice(10);

	$: username = profile ? profile['display_name'] : user;
</script>

<div
	class="text-center lg:text-left space-y-2 lg:space-y-0 lg:space-x-5 text-xl lg:flex items-center p-5"
>
	<!-- dot -->
	<span class="mx-auto lg:mx-0 mb-2 lg:mb-0 relative flex h-3 w-3">
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
			class="relative inline-flex rounded-full h-3 w-3 {action === 'create'
				? 'bg-created'
				: action === 'delete'
				? 'bg-deleted'
				: 'bg-link'}"
		/>
	</span>

	<div class="space-y-2 lg:space-y-0 lg:flex flex-wrap w-full justify-between items-center">
		<!-- event information -->
		<div class="space-y-2 lg:space-y-0">
			<span class="text-primary lg:mr-5">
				<!-- location -->
				<a
					href={action === 'delete'
						? `https://www.openstreetmap.org/#map=21/${lat}/${long}`
						: `/map?lat=${lat}&long=${long}`}
					target={action === 'delete' ? '_blank' : '_self'}
					rel="noreferrer"
					class="text-link hover:text-hover break-all transition-colors"
					>{location}
					{#if action === 'delete'}
						<svg
							class="inline"
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M3 13L13 3M13 3H5.5M13 3V10.5"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
				</a>

				<!-- action -->
				was
				<strong>{action}d</strong>

				<!-- user -->
				{#if username.length}
					by <a
						href="/tagger/{user.id}"
						class="block lg:inline text-link hover:text-hover break-all transition-colors"
						>{username}
					</a>
				{/if}
			</span>

			<!-- time ago -->
			<span
				class="text-center block lg:inline text-taggerTime font-semibold {lightning
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
