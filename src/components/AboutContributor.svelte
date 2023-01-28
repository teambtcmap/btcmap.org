<script>
	export let contributor;
</script>

<a
	href={contributor.url}
	target="_blank"
	rel="noreferrer"
	class="text-center space-y-2 hover:text-link transition-colors"
>
	<img
		src="/images/contributors/{contributor.name}.jpg"
		alt="avatar"
		class="rounded-full object-cover w-24 h-24 mx-auto"
		onerror="this.src='/images/satoshi-nakamoto.png'"
	/>

	<div>
		<p class="font-semibold">{contributor.name}</p>
		<p>{contributor.title}</p>
	</div>
</a>
