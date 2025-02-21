<script lang="ts">
	interface Props {
		scroll?: undefined | HTMLElement;
		style?: undefined | string;
	}

	let { scroll = undefined, style = undefined }: Props = $props();
</script>

<button
	onclick={() => (scroll ? scroll : window).scrollTo({ top: 0, behavior: 'smooth' })}
	class="h-8 w-8 animate-bounce rounded-full bg-link text-white hover:bg-hover {style} transition-colors"
>
	<i class="fa-solid fa-chevron-up"></i>
</button>
