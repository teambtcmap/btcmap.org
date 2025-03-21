<script lang="ts">
	export let position: string;
	export let click: () => void | boolean | undefined;
	export let colors: string;

	import { Icon } from '$lib/comp';
</script>

<div class={position}>
	<button on:click={click}>
		<Icon w="25" h="25" style="{colors} transition-colors" icon="close-rounded" />
	</button>
</div>
