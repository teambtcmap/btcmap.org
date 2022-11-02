<script>
	import Time from 'svelte-time';

	export let location;
	export let action;
	export let time;
	export let latest;
	export let lat;
	export let long;

	const capitalizeFirstLetter = (string) => {
		return string.charAt(0).toUpperCase() + string.slice(1);
	};
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
				<!-- action -->
				<span>{capitalizeFirstLetter(action)}d</span>

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
			</span>
		</div>

		<!-- time ago -->
		<span class="text-center block lg:inline text-taggerTime">
			<Time live={3000} relative timestamp={time} />
		</span>
	</div>
</div>
