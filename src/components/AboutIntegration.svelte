<script>
	export let integration;
</script>

<a
	href={integration.url}
	target="_blank"
	rel="noreferrer"
	class="space-y-2 hover:text-link transition-colors"
>
	<img
		src="/images/integrations/{integration.icon}{integration.icon === 'voltage' ? '.png' : '.jpg'}"
		alt="logo"
		class="rounded-full object-cover w-24 h-24 mx-auto"
		onerror="this.src='/images/communities/bitcoin.svg'"
	/>

	<p class="text-center font-semibold">{integration.name}</p>
</a>
