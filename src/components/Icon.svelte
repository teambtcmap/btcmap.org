<script lang="ts">
import IconIconify from "@iconify/svelte";

import { resolveMaterialIcon } from "$lib/materialIcons";

export let w: string;
export let h: string;
let className: string | undefined = undefined;

export { className as class };
export let icon: string;
export let type: "material" | "fa" = "material";

const faBrandIcons = ["x-twitter", "instagram", "facebook", "twitter"];

$: formattedIcon =
	type === "material"
		? resolveMaterialIcon(icon)
		: faBrandIcons.includes(icon)
			? `fa6-brands:${icon}`
			: `fa6-solid:${icon}`;
</script>

<IconIconify icon={formattedIcon} width={w} height={h} class={className} {...$$restProps} />
