<script lang="ts">
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import type { GeocodeResult } from "$lib/geocoding";
import { searchAddress } from "$lib/geocoding";
import { _, locale } from "$lib/i18n";

// Placement mode's address-first path (#1134, storyboard screen 1):
// people who know the street but not the map type it and jump there —
// the crosshair pin stays centered, so a jump is a placement, not a
// selection. Explicit submit only, mirroring the old form's address
// search: one Nominatim request per search the user asks for.
type Props = {
	onjump: (lat: number, long: number) => void;
};
let { onjump }: Props = $props();

let query = $state("");
// null = nothing searched yet (no dropdown at all).
let results = $state<GeocodeResult[] | null>(null);
let searching = $state(false);
let failed = $state(false);

const submit = async (event: SubmitEvent) => {
	event.preventDefault();
	const q = query.trim();
	if (!q || searching) return;
	searching = true;
	failed = false;
	try {
		results = await searchAddress(q, get(locale) ?? "en");
	} catch {
		results = null;
		failed = true;
	}
	searching = false;
};

const jump = (result: GeocodeResult) => {
	trackEvent("add_place_address_jump");
	results = null;
	query = "";
	onjump(result.lat, result.lon);
};
</script>

<div class="w-full">
	<form
		onsubmit={submit}
		class="flex h-11 items-center gap-2 rounded-full border border-input bg-white pr-1 pl-4 shadow-lg dark:bg-dark"
	>
		<input
			type="text"
			bind:value={query}
			placeholder={$_('map.placement.searchPlaceholder')}
			class="min-w-0 flex-1 bg-transparent text-sm text-primary placeholder:text-body/70 focus:outline-none dark:text-white dark:placeholder:text-offwhite/70"
		/>
		<button
			type="submit"
			disabled={searching}
			class="h-9 shrink-0 rounded-full bg-link px-4 text-sm font-semibold text-white transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
		>
			{searching ? '…' : $_('map.placement.searchAction')}
		</button>
	</form>

	{#if failed || results !== null}
		<div
			class="mt-2 overflow-hidden rounded-2xl border border-input bg-white shadow-lg dark:bg-dark"
		>
			{#if failed}
				<p class="px-4 py-3 text-sm text-error">
					{$_('map.placement.searchFailed')}
				</p>
			{:else if results && results.length === 0}
				<p class="px-4 py-3 text-sm text-body dark:text-offwhite">
					{$_('map.placement.searchNoResults')}
				</p>
			{:else if results}
				<ul>
					<!-- Nominatim can return identical display names — key by the
				     full tuple so rows never share one. -->
				{#each results as result (`${result.lat}/${result.lon}/${result.displayName}`)}
						<li>
							<button
								type="button"
								onclick={() => jump(result)}
								class="w-full truncate px-4 py-2.5 text-left text-sm text-primary hover:bg-link/10 focus:outline-link dark:text-white"
							>
								{result.displayName}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
