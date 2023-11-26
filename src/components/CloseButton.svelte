<script lang="ts">
	export let position;
	export let click;
	export let colors;

	import { Icon } from '$comp';
</script>

<div class={position}>
	<button on:click={click}>
		<Icon w="25" h="25" style="{colors} transition-colors" icon="close" type="popup" />
	</button>
</div>
