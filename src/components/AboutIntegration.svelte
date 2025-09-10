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
			src="/images/integrations/{integration.icon}{integration.icon === 'voltage' ||
			integration.icon === 'adopting'
				? '.png'
				: '.jpg'}"
			alt="logo"
			class="mx-auto h-24 w-24 rounded-full object-cover"
			on:error={function () {
				this.src = '/images/bitcoin.svg';
			}}
		/>

		<p class="text-center font-semibold">{integration.name}</p>
	</a>
	{#if integration.name === 'OpenStreetMap'}
		<a
			href="https://wiki.osmfoundation.org/wiki/Corporate_Members#Supporter_Corporate_Members"
			target="_blank"
			rel="noreferrer"
			class="mx-auto block w-32 rounded-full bg-link py-1 text-xs font-semibold text-white transition-colors hover:bg-hover"
		>
			Supporter
		</a>
	{/if}
</div>
