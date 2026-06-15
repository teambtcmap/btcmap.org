<script lang="ts">
import Icon from "$components/Icon.svelte";

// Collapse caret used by the bottom drawers/sheets (merchant drawer, search
// sheet). A round light background makes it read as a button. pointerdown is
// stopped so pressing it never starts a sheet drag.
export let onClick: () => void;
export let ariaLabel: string;
let className = "";

export { className as class };
</script>

<button
	type="button"
	on:pointerdown|stopPropagation
	on:click={onClick}
	class="grid h-8 w-8 touch-auto place-items-center rounded-full bg-gray-100 text-primary transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 {className}"
	aria-label={ariaLabel}
	{...$$restProps}
>
	<Icon w="20" h="20" icon="keyboard_arrow_down" type="material" />
</button>
