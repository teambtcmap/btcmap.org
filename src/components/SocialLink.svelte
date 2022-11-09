<script>
	export let url;
	export let social;

	import { Icon } from '$comp';
</script>

<a
	href={url}
	target="_blank"
	rel="noreferrer"
	class="inline-block bg-link hover:bg-hover rounded-full p-2 text-white transition-colors"
>
	<Icon w="28" h="28" icon={social} type="socials" />
</a>
