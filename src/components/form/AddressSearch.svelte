<script lang="ts">
import { createEventDispatcher, onDestroy } from "svelte";

import LoadingSpinner from "$components/LoadingSpinner.svelte";
import { type GeocodeResult, searchAddress } from "$lib/geocoding";
import { _ } from "$lib/i18n";

export let disabled = false;
export let locale = "en";

const dispatch = createEventDispatcher<{
	select: { lat: number; lng: number; displayName: string };
}>();

const COOLDOWN_SECONDS = 3;

let query = "";
let loading = false;
let cooldownRemaining = 0;
let cooldownTimer: ReturnType<typeof setInterval> | undefined;
let results: GeocodeResult[] = [];
let errorState: "none" | "no-results" | "network" = "none";
let activeIndex = -1;
let lastSearchedQuery = "";

$: canSubmit =
	!disabled && !loading && cooldownRemaining === 0 && query.trim().length > 0;

// If the user edits the input after a search, the previously rendered
// results / error message no longer match what's typed. Clear them so a
// stray Enter can't pick a result that doesn't correspond to the visible query.
$: if (
	query.trim() !== lastSearchedQuery &&
	(results.length > 0 || errorState !== "none")
) {
	results = [];
	errorState = "none";
	activeIndex = -1;
}

function emitSelect(r: GeocodeResult) {
	dispatch("select", { lat: r.lat, lng: r.lon, displayName: r.displayName });
}

function startCooldown() {
	cooldownRemaining = COOLDOWN_SECONDS;
	cooldownTimer = setInterval(() => {
		cooldownRemaining -= 1;
		if (cooldownRemaining <= 0) {
			if (cooldownTimer) clearInterval(cooldownTimer);
			cooldownTimer = undefined;
			cooldownRemaining = 0;
		}
	}, 1000);
}

async function runSearch() {
	if (!canSubmit) return;
	const submitted = query.trim();
	lastSearchedQuery = submitted;
	loading = true;
	errorState = "none";
	results = [];
	activeIndex = -1;
	try {
		const found = await searchAddress(submitted, locale);
		// If the user edited the query while we were waiting, drop the result.
		if (query.trim() !== submitted) return;
		if (found.length === 0) {
			errorState = "no-results";
		} else if (found.length === 1) {
			emitSelect(found[0]);
		} else {
			results = found;
		}
	} catch (err) {
		console.error("Geocoding failed:", err);
		errorState = "network";
	} finally {
		loading = false;
		startCooldown();
	}
}

function selectResult(index: number) {
	const r = results[index];
	if (!r) return;
	emitSelect(r);
	results = [];
	activeIndex = -1;
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Enter" && results.length === 0) {
		e.preventDefault();
		runSearch();
		return;
	}
	if (results.length === 0) return;
	if (e.key === "ArrowDown") {
		e.preventDefault();
		activeIndex = (activeIndex + 1) % results.length;
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		activeIndex = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
	} else if (e.key === "Enter" && activeIndex >= 0) {
		e.preventDefault();
		selectResult(activeIndex);
	} else if (e.key === "Escape") {
		results = [];
		activeIndex = -1;
	}
}

onDestroy(() => {
	if (cooldownTimer) clearInterval(cooldownTimer);
});
</script>

<div class="space-y-2">
	<div class="flex space-x-2">
		<input
			type="text"
			bind:value={query}
			on:keydown={handleKeydown}
			{disabled}
			placeholder={$_('addressSearch.placeholder')}
			aria-label={$_('addressSearch.placeholder')}
			role="combobox"
			aria-haspopup="listbox"
			aria-expanded={results.length > 0}
			aria-controls="address-search-results"
			aria-autocomplete="list"
			aria-activedescendant={activeIndex >= 0
				? `address-search-result-${activeIndex}`
				: undefined}
			class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
		/>
		<button
			type="button"
			on:click={runSearch}
			disabled={!canSubmit}
			class="flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-link bg-link px-4 py-3 font-semibold text-white transition-colors hover:border-hover hover:bg-hover disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-500"
		>
			{#if loading}
				<LoadingSpinner />
			{:else if cooldownRemaining > 0}
				{$_('addressSearch.buttonWait', { values: { seconds: cooldownRemaining } })}
			{:else}
				{$_('addressSearch.buttonSearch')}
			{/if}
		</button>
	</div>

	<p class="text-xs text-primary/70 dark:text-white/60">
		{$_('addressSearch.rateHint')}
	</p>

	{#if errorState === 'no-results'}
		<p class="text-sm font-semibold text-error">
			{$_('addressSearch.noResults')}
		</p>
	{:else if errorState === 'network'}
		<p class="text-sm font-semibold text-error">
			{$_('addressSearch.networkError')}
		</p>
	{/if}

	{#if results.length > 0}
		<ul
			id="address-search-results"
			role="listbox"
			class="overflow-hidden rounded-2xl border-2 border-input dark:bg-white/[0.05]"
		>
			{#each results as result, i (result.displayName + i)}
				<li
					id="address-search-result-{i}"
					role="option"
					aria-selected={activeIndex === i}
				>
					<button
						type="button"
						on:click={() => selectResult(i)}
						on:mouseenter={() => (activeIndex = i)}
						class="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-link/10 {activeIndex ===
						i
							? 'bg-link/10'
							: ''}"
					>
						{result.displayName}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
