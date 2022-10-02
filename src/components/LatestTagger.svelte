<script>
	import { render } from 'timeago.js';

	export let location;
	export let action;
	export let user;
	export let time;
	export let latest;
	export let lat;
	export let long;

	let timeElement;
	$: timeElement && render(timeElement, 'en_US', { minInterval: 3 });
</script>

<div class="text-center md:text-left space-y-2 md:space-y-0 text-xl md:flex items-center p-5">
	<span class="mx-auto md:mx-0 mb-2 md:mb-0 relative flex h-3 w-3">
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

	<div class="space-y-2 md:space-y-0 md:flex w-full justify-between items-center">
		<span class="break-all md:mx-5 text-primary">
			<a href="/map?lat={lat}&long={long}" class="text-link hover:text-hover">{location}</a> was
			<strong>{action}d</strong>
			{#if action !== 'delete'}
				by <a
					href="https://www.openstreetmap.org/user/{user}"
					target="_blank"
					rel="noreferrer"
					class="text-link hover:text-hover"
					>{user}
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
					</svg></a
				>
			{/if}
		</span>

		<span
			bind:this={timeElement}
			datetime={time}
			class="text-center block md:inline text-taggerTime font-semibold"
		/>
	</div>
</div>
