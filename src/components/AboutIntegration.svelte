<script lang="ts">
	export let integration: { url: string; icon: string; name: string };
</script>

<div class="space-y-2">
	<a
		href={integration.url}
		target="_blank"
		rel="noreferrer"
		class="space-y-2 transition-colors hover:text-link"
	>
		<img
			src="/images/integrations/{integration.icon}{integration.icon === 'voltage'
				? '.png'
				: '.jpg'}"
			alt="logo"
			class="mx-auto h-24 w-24 rounded-full object-cover"
			on:error={function () {
				this.src = '/images/communities/bitcoin.svg';
			}}
		/>

		<p class="text-center font-semibold">{integration.name}</p>
	</a>
	{#if integration.name === 'OpenStreetMap'}
		<a
			href="https://wiki.osmfoundation.org/wiki/Corporate_Members#Bronze_Corporate_Members"
			target="_blank"
			rel="noreferrer"
			class="mx-auto block w-32 rounded-full bg-[#ffab01] py-1 text-xs font-semibold text-black"
		>
			Bronze Sponsor
		</a>
	{/if}
</div>
