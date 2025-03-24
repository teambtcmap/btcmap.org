<script lang="ts">
	import IconIconify from '@iconify/svelte';

	import type { IconName as IconNameSocials } from '$lib/spritesheet-socials.ts';
	import type { IconName as IconNameApps } from '$lib/spritesheet-apps.ts';
	import type { IconName as IconNamePopup } from '$lib/spritesheet-popup.ts';
	import type { IconName as IconNameMobileNav } from '$lib/spritesheet-mobile-nav.ts';

	export let w: string;
	export let h: string;
	export let style: undefined | string = undefined;
	export let icon: IconNameApps | IconNamePopup | IconNameMobileNav | IconNameSocials;
	export let type: 'apps' | 'material' | 'mobile-nav' | 'popup' | 'socials';

	$: formattedMaterialIcon = type === 'material' ? `ic:outline-${icon.replace(/_/g, '-')}` : icon;

	$: spriteHref =
		{
			socials: '/icons/spritesheet-socials.svg',
			apps: '/icons/spritesheet-apps.svg',
			popup: '/icons/spritesheet-popup.svg',
			'mobile-nav': '/icons/spritesheet-mobile-nav.svg'
		}[type as Exclude<typeof type, 'material'>] || '';
</script>

{#if type === 'material'}
	<IconIconify icon={formattedMaterialIcon} width={w} height={h} class={style} />
{:else}
	<svg width="{w}px" height="{h}px" class={style}>
		<use width="{w}px" height="{h}px" href={`${spriteHref}#${icon}`} />
	</svg>
{/if}
