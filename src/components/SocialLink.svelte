<script lang="ts">
	export let url: string;
	export let social: string;

	import Icon from '$components/Icon.svelte';

	const socialLabels: Record<string, string> = {
		matrix: 'Matrix',
		github: 'GitHub',
		amboss: 'Amboss',
		nostr: 'Nostr',
		x: 'X (Twitter)'
	};
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<a
	href={url}
	target="_blank"
	rel="noreferrer"
	aria-label={socialLabels[social] || social}
	class="inline-block rounded-full bg-link p-2 text-white transition-colors hover:bg-hover dark:bg-white/[0.15] dark:hover:bg-link"
>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	<Icon w="28" h="28" icon={social} type="socials" />
</a>
