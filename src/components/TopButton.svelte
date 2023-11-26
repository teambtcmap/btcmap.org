<script lang="ts">
	export let scroll = undefined;
	export let style = undefined;
</script>

<button
	on:click={() => (scroll ? scroll : window).scrollTo({ top: 0, behavior: 'smooth' })}
	class="h-8 w-8 animate-bounce rounded-full bg-link text-white hover:bg-hover {style} transition-colors"
>
	<i class="fa-solid fa-chevron-up" />
</button>
