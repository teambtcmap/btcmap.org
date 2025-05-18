<script lang="ts">
	export let position: string = 'flex justify-end';
	export let colors: string =
		'text-primary dark:text-white dark:hover:text-white/80 hover:text-link';

	import { Icon } from '$lib/comp';
</script>

<div class={position}>
	<button on:click>
		<Icon w="25" h="25" style="{colors} transition-colors" icon="close_round" />
	</button>
</div>
