<script lang="ts">
	import type { EventType } from '$lib/types';
	import Time from 'svelte-time';

	interface Props {
		location: string;
		action: EventType;
		time: string;
		latest: boolean;
		merchantId: string;
	}

	let {
		location,
		action,
		time,
		latest,
		merchantId
	}: Props = $props();

	let deleteLink = $derived(merchantId.split(':'));

	const capitalizeFirstLetter = (string: string) => {
		return string.charAt(0).toUpperCase() + string.slice(1);
	};
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
		></span>
		<span
			class="relative inline-flex h-3 w-3 rounded-full {action === 'create'
				? 'bg-created'
				: action === 'delete'
					? 'bg-deleted'
					: 'bg-link'}"
		></span>
	</span>

	<div class="w-full flex-wrap items-center justify-between space-y-2 lg:flex lg:space-y-0">
		<!-- event information -->
		<div class="space-y-2 lg:space-y-0">
			<span class="text-primary dark:text-white lg:mr-5">
				<!-- action -->
				<span>{capitalizeFirstLetter(action)}d</span>

				<!-- location -->
				<a
					href={action === 'delete'
						? `https://www.openstreetmap.org/${deleteLink[0]}/${deleteLink[1]}`
						: `/merchant/${merchantId}`}
					target={action === 'delete' ? '_blank' : null}
					rel={action === 'delete' ? 'noreferrer' : null}
					class="break-all text-link transition-colors hover:text-hover"
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
		<span class="block text-center text-taggerTime lg:inline">
			<Time live={3000} relative timestamp={time} />
		</span>
	</div>
</div>
