<script lang="ts">
import axios from "axios";
import axiosRetry from "axios-retry";

import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { boost, resetBoost } from "$lib/store";
import type { Place } from "$lib/types";

export let merchant: Place | undefined;
export let boosted: string | undefined;
export let style: "button" | "link" = "button";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

let boostLoading = false;

const resetBoostLoading = () => {
	boostLoading = false;
};

const startBoost = async () => {
	if (!merchant) return;

	boostLoading = true;

	$boost = {
		id: merchant.id,
		name: merchant.name || "",
		boost: boosted || "",
	};
};

$: $resetBoost && resetBoostLoading();
</script>

{#if style === 'button'}
	<button
		id="boost-button"
		on:click={startBoost}
		disabled={boostLoading}
		class="{boosted
			? 'border border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-600/40 dark:text-amber-300 dark:hover:bg-amber-900/30'
			: 'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500'} mx-auto flex w-40 items-center justify-center rounded-xl p-3 text-center font-semibold transition-colors disabled:opacity-50"
	>
		<Icon
			w="20"
			h="20"
			class="mr-1"
			icon={boosted ? 'arrow_circle_up' : 'rocket_launch'}
			type="material"
		/>
		{boostLoading
			? $_('boost.boosting')
			: boosted
				? $_('boost.extendBoost')
				: $_('boost.boostThisPlace')}
	</button>
{:else}
	<button
		id="boost-button"
		on:click={startBoost}
		disabled={boostLoading || Boolean($boost)}
		class="inline-flex items-center space-x-1 font-semibold text-link transition-colors hover:text-hover"
	>
		<Icon
			w="16"
			h="16"
			icon={boosted ? 'arrow_circle_up' : 'rocket_launch'}
			class="shrink-0"
			type="material"
		/>
		<p class="text-sm">
			{boostLoading
				? $_('boost.boosting')
				: boosted
					? $_('boost.extendBoost')
					: $_('boost.boostThisPlace')}
		</p>
	</button>
{/if}
