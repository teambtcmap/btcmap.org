<script lang="ts">
import Icon from "$components/Icon.svelte";

export let value: string;

let copied = false;

const copy = async (field: string) => {
	try {
		await navigator.clipboard.writeText(field);
	} catch {
		// fallback for browsers/contexts where clipboard API is unavailable
		const el = document.createElement("textarea");
		el.value = field;
		el.style.position = "fixed";
		el.style.opacity = "0";
		document.body.appendChild(el);
		el.focus();
		el.select();
		document.execCommand("copy");
		document.body.removeChild(el);
	}
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
