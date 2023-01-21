<script>
	export let scroll = undefined;
	export let style = undefined;
</script>

<button
	on:click={() => (scroll ? scroll : window).scrollTo({ top: 0, behavior: 'smooth' })}
	class="animate-bounce w-8 h-8 bg-link hover:bg-hover rounded-full text-white {style} transition-colors"
>
	<i class="fa-solid fa-chevron-up" />
</button>
