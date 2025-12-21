<script lang="ts">
	import type { SocialIconName } from '$lib/icons/types';
	import IconSocials from '$lib/icons/IconSocials.svelte';

	export let url: string;
	export let social: SocialIconName;

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
	aria-label={`Visit us on ${socialLabels[social] || social}`}
	class="inline-block rounded-full bg-link p-2 text-white transition-colors hover:bg-hover dark:bg-white/[0.15] dark:hover:bg-link"
>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	<IconSocials w="28" h="28" icon={social} />
</a>
