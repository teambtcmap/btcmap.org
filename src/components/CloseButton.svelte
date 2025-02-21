<script lang="ts">

	import { Icon } from '$lib/comp';
	interface Props {
		position: string;
		click: () => void | boolean | undefined;
		colors: string;
	}

	let { position, click, colors }: Props = $props();
</script>

<div class={position}>
	<button onclick={click}>
		<Icon w="25" h="25" style="{colors} transition-colors" icon="close" type="popup" />
	</button>
</div>
