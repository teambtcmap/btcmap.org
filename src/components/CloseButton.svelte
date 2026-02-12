<script lang="ts">
export let position: string = "flex justify-end";
export let colors: string =
	"text-primary dark:text-white dark:hover:text-white/80 hover:text-link";
export let ariaLabel: string = "Close";

import Icon from "$components/Icon.svelte";
</script>

<div class={position}>
	<button on:click type="button" aria-label={ariaLabel}>
		<Icon w="20" h="20" class="{colors} transition-colors" icon="close_round" />
	</button>
</div>
