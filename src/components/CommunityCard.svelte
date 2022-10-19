<script>
	export let name;
	export let id;
	export let tags;

	$: image = tags['icon:square'] && tags['icon:square'];
	$: discord = tags['contact:discord'] && tags['contact:discord'];
	$: telegram = tags['contact:telegram'] && tags['contact:telegram'];
	$: twitter = tags['contact:twitter'] && tags['contact:twitter'];
	$: website = tags['contact:website'] && tags['contact:website'];
	$: youtube = tags['contact:youtube'] && tags['contact:youtube'];
</script>

<div class="border border-statBorder rounded-3xl shadow hover:shadow-2xl transition-shadow">
	<div class="space-y-2 my-4 p-4">
		<img
			src={image ? image : '/images/communities/bitcoin.svg'}
			alt={name}
			class="w-20 h-20 object-cover rounded-full mx-auto"
		/>

		<a
			href="/community/{id}"
			class="text-center text-link hover:text-hover text-lg font-semibold block">{name}</a
		>
	</div>

	<div class="p-4 w-full flex flex-wrap justify-center items-center border-t border-t-statBorder">
		{#if website}
			<a href={website} target="_blank" rel="noreferrer" class="m-1">
				<span class="bg-bitcoin w-[40px] h-[40px] flex justify-center items-center rounded-full">
					<i class="text-white w-7 h-7 fa-solid fa-globe" />
				</span>
			</a>
		{/if}
		{#if twitter}
			<a href={twitter} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/twitter.svg" alt="twitter" />
			</a>
		{/if}
		{#if telegram}
			<a href={telegram} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/telegram.svg" alt="telegram" />
			</a>
		{/if}
		{#if discord}
			<a href={discord} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/discord.svg" alt="discord" />
			</a>
		{/if}
		{#if youtube}
			<a href={youtube} target="_blank" rel="noreferrer" class="m-1">
				<img src="/icons/socials/youtube.svg" alt="youtube" />
			</a>
		{/if}
	</div>
</div>
