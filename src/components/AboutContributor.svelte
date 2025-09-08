<script lang="ts">
	export let contributor: { url: string; name: string; file: string; title: string };
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a
	href={contributor.url}
	target="_blank"
	rel="noreferrer"
	class="space-y-2 text-center transition-colors hover:text-link"
>
	<img
		src="/images/contributors/{contributor.name}.{contributor.file}"
		alt="avatar"
		class="mx-auto h-24 w-24 rounded-full object-cover"
		on:error={function () {
			this.src = '/images/satoshi-nakamoto.png';
		}}
	/>

	<div>
		<p class="font-semibold">{contributor.name}</p>
		<p>{contributor.title}</p>
	</div>
</a>
