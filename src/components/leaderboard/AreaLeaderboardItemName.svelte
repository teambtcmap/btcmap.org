<script lang="ts">
import { locale } from "svelte-i18n";

import { getCountryName } from "$lib/countryNames";
import type { AreaType } from "$lib/types";

export let type: AreaType;
export let avatar: string;
export let name: string;
export let id: string;
/** Country ISO code (e.g. "za") - required for type "country" to translate name */
export let countryCode: string | undefined = undefined;

$: avatarSrc =
	type === "community"
		? `https://btcmap.org/.netlify/images?url=${avatar}&fit=cover&w=256&h=256`
		: avatar;

let _nameGen = 0;
let localizedName = name || "Unknown";
$: {
	const gen = ++_nameGen;
	const fallback = name || "Unknown";
	localizedName = fallback;
	if (type === "country" && countryCode) {
		getCountryName(countryCode, $locale ?? "en", fallback)
			.then((n) => {
				if (gen === _nameGen) localizedName = n;
			})
			.catch(() => {});
	}
}

$: hasLongName = localizedName?.match(/[^ ]{21}/);

function handleImageError(event: Event) {
	const img = event.target as HTMLImageElement;
	img.src = "/images/bitcoin.svg";
}
</script>

{#if name}
	<div class="flex items-center gap-3">
		<img
			src={avatarSrc}
			alt="{localizedName} avatar"
			class="h-10 w-10 shrink-0 rounded-full object-cover"
			on:error={handleImageError}
			loading="lazy"
		/>
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={`/${type}/${id}`}
			class="font-medium text-link transition-colors hover:text-hover {hasLongName
				? 'break-all'
				: ''}"
			aria-label="View {localizedName} details"
		>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{localizedName}
		</a>
	</div>
{:else}
	<!-- Skeleton loading state -->
	<div class="flex items-center gap-3" role="status" aria-label="Loading area information">
		<div class="h-10 w-10 shrink-0 animate-pulse rounded-full bg-link/50" aria-hidden="true"></div>
		<div class="h-5 w-24 animate-pulse rounded bg-link/50" aria-hidden="true"></div>
		<span class="sr-only">Loading...</span>
	</div>
{/if}
