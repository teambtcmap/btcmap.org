<script>
	export let text;
	export let link;
	export let style;
</script>

<a
	href={link}
	class="block bg-link hover:bg-hover text-2xl text-white text-center font-semibold rounded-xl p-4 {style}"
>
	{text}
</a>
