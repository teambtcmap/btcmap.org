<script>
	export let scroll;
	export let style;
</script>

<button
	on:click={() => (scroll ? scroll : window).scrollTo({ top: 0, behavior: 'smooth' })}
	class="animate-bounce w-8 h-8 bg-link hover:bg-hover rounded-full text-white {style}"
>
	<i class="fa-solid fa-chevron-up" />
</button>
