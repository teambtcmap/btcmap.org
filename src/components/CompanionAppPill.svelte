<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
import { sanitizeUrl } from "$lib/utils";

export let url: string;

$: safeUrl = sanitizeUrl(url);
$: appName = (() => {
	if (!safeUrl) return null;
	try {
		return new URL(safeUrl).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
})();
</script>

{#if safeUrl}
<a
	href={safeUrl}
	target="_blank"
	rel="noopener noreferrer"
	class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
>
	<Icon w="14" h="14" icon="smartphone" type="material" />
	{appName || $_("payment.thirdPartyRequired")}
</a>
{/if}
