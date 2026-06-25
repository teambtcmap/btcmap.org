<script lang="ts">
import Modal from "$components/Modal.svelte";
import { _ } from "$lib/i18n";
import type { BasemapId } from "$lib/map/basemaps";
import type { VerifiedFilterYears } from "$lib/map/verifiedFilter";
import { VERIFIED_FILTER_OPTIONS } from "$lib/map/verifiedFilter";

type BasemapEntry = { id: BasemapId; label: string };

export let open = false;
export let basemaps: BasemapEntry[];
export let currentBasemap: BasemapId | undefined = undefined;
export let onSelectBasemap: (id: BasemapId) => void;

// Optional sections — /map wires all of them; /communities/map passes only
// the basemap picker, so verified/overlays stay hidden there.
export let currentVerified: VerifiedFilterYears = null;
export let onSelectVerified:
	| ((years: VerifiedFilterYears) => void | Promise<void>)
	| null = null;
export let heatmapOn = false;
export let onToggleHeatmap: ((enabled: boolean) => void) | null = null;
export let boostActive = false;
export let onToggleBoost: (() => void) | null = null;

let verifiedLoading = false;

async function selectVerified(years: VerifiedFilterYears) {
	if (!onSelectVerified) return;
	// Spinner covers the one-time on-demand verified-date fetch; instant once loaded.
	verifiedLoading = true;
	try {
		await onSelectVerified(years);
	} finally {
		verifiedLoading = false;
	}
}

$: hasOverlays = !!onToggleHeatmap || !!onToggleBoost;
</script>

<Modal bind:open title={$_("mapControls.layersAndFilters")} titleId="map-tools-title">
	<div class="space-y-6">
		<!-- Basemap -->
		<section>
			<h3
				class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/50"
			>
				{$_("mapControls.basemapTitle")}
			</h3>
			<div role="radiogroup">
				{#each basemaps as bm (bm.id)}
					<label
						class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-body hover:bg-gray-100 dark:text-white dark:hover:bg-white/5"
					>
						<input
							type="radio"
							name="basemap"
							value={bm.id}
							checked={bm.id === currentBasemap}
							on:change={() => onSelectBasemap(bm.id)}
							class="accent-primary"
						/>
						<span>{bm.label}</span>
					</label>
				{/each}
			</div>
		</section>

		<!-- Verified filter -->
		{#if onSelectVerified}
			<section>
				<h3
					class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/50"
				>
					{$_("mapControls.verifiedFilterTitle")}
				</h3>
				<div role="radiogroup" class:opacity-50={verifiedLoading}>
					{#each VERIFIED_FILTER_OPTIONS as opt (opt.labelKey)}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-body hover:bg-gray-100 dark:text-white dark:hover:bg-white/5"
						>
							<input
								type="radio"
								name="verified"
								checked={opt.value === currentVerified}
								disabled={verifiedLoading}
								on:change={() => selectVerified(opt.value)}
								class="accent-primary"
							/>
							<span>{$_(opt.labelKey)}</span>
						</label>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Overlays -->
		{#if hasOverlays}
			<section>
				<h3
					class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/50"
				>
					{$_("mapControls.overlaysTitle")}
				</h3>
				{#if onToggleHeatmap}
					<button
						type="button"
						role="switch"
						aria-checked={heatmapOn}
						on:click={() => onToggleHeatmap?.(!heatmapOn)}
						class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-body hover:bg-gray-100 dark:text-white dark:hover:bg-white/5"
					>
						<span>{$_("mapControls.heatmap")}</span>
						<span
							class="relative inline-block h-5 w-9 flex-none rounded-full transition-colors {heatmapOn
								? 'bg-primary'
								: 'bg-gray-300 dark:bg-white/20'}"
						>
							<span
								class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform {heatmapOn
									? 'translate-x-4'
									: 'translate-x-0'}"
							/>
						</span>
					</button>
				{/if}
				{#if onToggleBoost}
					<button
						type="button"
						role="switch"
						aria-checked={boostActive}
						on:click={() => onToggleBoost?.()}
						class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-body hover:bg-gray-100 dark:text-white dark:hover:bg-white/5"
					>
						<span>{$_("mapControls.boostedOnly")}</span>
						<span
							class="relative inline-block h-5 w-9 flex-none rounded-full transition-colors {boostActive
								? 'bg-primary'
								: 'bg-gray-300 dark:bg-white/20'}"
						>
							<span
								class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform {boostActive
									? 'translate-x-4'
									: 'translate-x-0'}"
							/>
						</span>
					</button>
				{/if}
			</section>
		{/if}
	</div>
</Modal>
