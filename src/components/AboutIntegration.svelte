<script>
	export let integration;
</script>

<a
	href={integration.url}
	target="_blank"
	rel="noreferrer"
	class="space-y-2 transition-colors hover:text-link"
>
	<img
		src="/images/integrations/{integration.icon}{integration.icon === 'voltage' ? '.png' : '.jpg'}"
		alt="logo"
		class="mx-auto h-24 w-24 rounded-full object-cover"
		onerror="this.src='/images/communities/bitcoin.svg'"
	/>

	<p class="text-center font-semibold">{integration.name}</p>
</a>
