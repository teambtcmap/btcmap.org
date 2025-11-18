<script lang="ts">
	import Icon from '$components/Icon.svelte';
	export let scroll: undefined | HTMLElement = undefined;
	export let style: undefined | string = undefined;
</script>

<button
	on:click={() => (scroll ? scroll : window).scrollTo({ top: 0, behavior: 'smooth' })}
	class="h-8 w-8 animate-bounce rounded-full bg-link text-white hover:bg-hover {style} transition-colors flex items-center justify-center"
>
	<Icon type="fa" icon="chevron-up" w="16" h="16" />
</button>
