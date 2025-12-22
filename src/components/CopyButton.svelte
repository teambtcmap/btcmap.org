<script lang="ts">
	import Icon from '$components/Icon.svelte';

	export let value: string;

	let copied = false;

	const copy = (field: string) => {
		navigator.clipboard.writeText(field);
		copied = true;
		setTimeout(() => (copied = false), 2100);
	};
</script>

<button class="text-link transition-colors hover:text-hover" on:click={() => copy(value)}>
	{#if copied}
		<Icon type="fa" icon="check" w="24" h="24" />
	{:else}
		<Icon type="fa" icon="clipboard" w="24" h="24" />
	{/if}
</button>
