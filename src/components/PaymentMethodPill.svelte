<script lang="ts">
import { theme } from "$lib/theme";

export let method: "btc" | "ln" | "nfc";
export let label: string;

const iconPaths = {
	btc: {
		light: "/icons/btc-highlight.svg",
		dark: "/icons/btc-highlight-dark.svg",
	},
	ln: {
		light: "/icons/ln-highlight.svg",
		dark: "/icons/ln-highlight-dark.svg",
	},
	nfc: {
		light: "/icons/nfc-highlight.svg",
		dark: "/icons/nfc-highlight-dark.svg",
	},
};

const pillColors = {
	btc: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
	ln: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	nfc: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

$: iconSrc =
	$theme === "dark" ? iconPaths[method].dark : iconPaths[method].light;
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium {pillColors[
		method
	]}"
>
	<img src={iconSrc} alt="" class="h-4 w-4" />
	{label}
</span>
