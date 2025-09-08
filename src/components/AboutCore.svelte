<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	export let member: {
		avatar: string;
		name: string;
		title: string;
		socials: { url: string; name: string }[];
	};

	import { Icon } from '$lib/comp';
</script>

<div class="space-y-2 text-center">
	<img
		src="/images/team/{member.avatar}.jpg"
		alt="avatar"
		class="mx-auto h-28 w-28 rounded-full object-cover"
		on:error={function () {
			this.src = '/images/satoshi-nakamoto.png';
		}}
	/>

	<div>
		<p class="font-semibold">{member.name}</p>
		<p>{member.title}</p>
	</div>

	<div class="flex justify-center space-x-2">
		{#each member.socials as social (social.url)}
			<a
				href={social.url}
				target="_blank"
				rel="noreferrer"
				class="inline-block rounded-full bg-[#AFBBC9] p-2 text-white transition-opacity hover:opacity-80"
			>
				<Icon w="16" h="16" icon={social.name} type="socials" />
			</a>
		{/each}
	</div>
</div>
