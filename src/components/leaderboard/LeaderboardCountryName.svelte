<script lang="ts">
import { locale } from "svelte-i18n";

import { getCountryName } from "$lib/countryNames";

export let countryCode: string;
export let name: string;

let _nameGen = 0;
let localizedName = name || "Unknown";
$: {
	const gen = ++_nameGen;
	const fallback = name || "Unknown";
	localizedName = fallback;
	getCountryName(countryCode, $locale ?? "en", fallback)
		.then((n) => {
			if (gen === _nameGen) localizedName = n;
		})
		.catch(() => {});
}
</script>

{localizedName}
