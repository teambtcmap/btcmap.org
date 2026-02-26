<script lang="ts">
import { locale } from "svelte-i18n";

import { getCountryName } from "$lib/countryNames";

import { resolve } from "$app/paths";

export let id: string;
export let name: string;

let localizedName = name;
let nameRequestId = 0;
$: currentLocale = $locale ?? "en";
$: {
	const requestId = ++nameRequestId;
	localizedName = name;
	getCountryName(id, currentLocale, name)
		.then((n) => {
			if (requestId === nameRequestId) localizedName = n;
		})
		.catch(() => {
			if (requestId === nameRequestId) localizedName = name;
		});
}
</script>

<div
	class="rounded-3xl border border-gray-300 shadow transition-shadow hover:shadow-2xl dark:border-white/95 dark:bg-white/10"
>
	<div class="my-4 space-y-2 p-4">
		<a
			href={resolve(`/country/${id}`)}
			class="space-y-2 text-link transition-colors hover:text-hover"
		>
			<img
				src={`https://static.btcmap.org/images/countries/${id}.svg`}
				alt={localizedName}
				class="mx-auto h-20 w-20 rounded-full object-cover"
				on:error={function () {
					this.src = '/images/bitcoin.svg';
				}}
			/>

			<span
				data-testid="country-name"
				class="block text-center text-lg font-semibold"
				>{localizedName}</span
			>
		</a>
	</div>
</div>
