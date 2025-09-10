<script lang="ts">
	import type { AreaType } from '$lib/types';
	import { resolve } from '$app/paths';

	export let type: AreaType;
	export let avatar: string;
	export let name: string;
	export let id: string;

	$: avatarSrc =
		type === 'community'
			? `https://btcmap.org/.netlify/images?url=${avatar}&fit=cover&w=256&h=256`
			: avatar;

	$: hasLongName = name?.match(/[^ ]{21}/);
	$: displayName = name || 'Unknown';

	function handleImageError(event: Event) {
		const img = event.target as HTMLImageElement;
		img.src = '/images/bitcoin.svg';
	}
</script>

{#if name}
	<div class="flex items-center gap-3">
		<img
			src={avatarSrc}
			alt="{displayName} avatar"
			class="h-10 w-10 flex-shrink-0 rounded-full object-cover"
			on:error={handleImageError}
			loading="lazy"
		/>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a
			href={`/${type}/${id}`}
			class="font-medium text-link transition-colors hover:text-hover {hasLongName
				? 'break-all'
				: ''}"
			aria-label="View {displayName} details"
		>
			{displayName}
		</a>
	</div>
{:else}
	<!-- Skeleton loading state -->
	<div class="flex items-center gap-3" role="status" aria-label="Loading area information">
		<div
			class="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-link/50"
			aria-hidden="true"
		></div>
		<div class="h-5 w-24 animate-pulse rounded bg-link/50" aria-hidden="true"></div>
		<span class="sr-only">Loading...</span>
	</div>
{/if}
