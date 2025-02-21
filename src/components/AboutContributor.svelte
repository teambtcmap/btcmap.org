<script lang="ts">
	interface Props {
		contributor: { url: string; name: string; file: string; title: string };
	}

	let { contributor }: Props = $props();
</script>

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
		onerror={function () {
			this.src = '/images/satoshi-nakamoto.png';
		}}
	/>

	<div>
		<p class="font-semibold">{contributor.name}</p>
		<p>{contributor.title}</p>
	</div>
</a>
