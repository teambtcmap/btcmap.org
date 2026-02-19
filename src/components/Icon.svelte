<script lang="ts">
import IconIconify from "@iconify/svelte";

export let w: string;
export let h: string;
let className: string | undefined = undefined;
export { className as class };
export let icon: string;
export let type: "material" | "fa" = "material";

const materialExceptions: Record<string, string> = {
	camping: "material-symbols:camping-rounded",
	gate: "material-symbols:gate",
	cooking: "material-symbols:cooking",
	dentistry: "material-symbols:dentistry",
	sauna: "material-symbols:sauna",
	info_outline: "material-symbols:info-outline",
	skull: "material-symbols:skull",
	currency_bitcoin: "material-symbols:currency-bitcoin",
	close_round: "ic:round-close",
	my_location: "material-symbols:my-location-rounded",
};

const faBrandIcons = ["x-twitter", "instagram", "facebook", "twitter"];

$: formattedIcon =
	type === "material"
		? materialExceptions[icon] || `ic:outline-${icon.replace(/_/g, "-")}`
		: faBrandIcons.includes(icon)
			? `fa6-brands:${icon}`
			: `fa6-solid:${icon}`;
</script>

<IconIconify icon={formattedIcon} width={w} height={h} class={className} {...$$restProps} />
