<script>
	export let member;

	import { Icon } from '$comp';
</script>

<div class="text-center space-y-2">
	<img
		src="/images/team/{member.avatar}.jpg"
		alt="avatar"
		class="rounded-full object-cover w-28 h-28 mx-auto"
		onerror="this.src='/images/satoshi-nakamoto.png'"
	/>

	<div>
		<p class="font-semibold">{member.name}</p>
		<p>{member.title}</p>
	</div>

	<div class="flex justify-center space-x-2">
		{#each member.socials as social}
			<a
				href={social.url}
				target="_blank"
				rel="noreferrer"
				class="inline-block bg-[#AFBBC9] rounded-full p-2 text-white hover:opacity-80 transition-opacity"
			>
				<Icon w="16" h="16" icon={social.name} type="socials" />
			</a>
		{/each}
	</div>
</div>
