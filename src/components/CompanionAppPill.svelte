<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";

export let url: string;

$: appName = (() => {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
})();
</script>

<a
	href={url}
	target="_blank"
	rel="noreferrer"
	class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
>
	<Icon w="14" h="14" icon="smartphone" type="material" />
	{appName || $_("payment.thirdPartyRequired")}
</a>
