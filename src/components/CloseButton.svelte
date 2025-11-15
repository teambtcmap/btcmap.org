<script lang="ts">
	export let position: string = 'flex justify-end';
	export let colors: string =
		'text-primary dark:text-white dark:hover:text-white/80 hover:text-link';

	import Icon from '$components/Icon.svelte';
</script>

<div class={position}>
	<button on:click type="button" aria-label="Close">
		<Icon w="25" h="25" style="{colors} transition-colors" icon="close_round" />
	</button>
</div>
