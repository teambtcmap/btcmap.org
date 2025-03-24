<script lang="ts">
	import IconIconify from '@iconify/svelte';

	import type { IconName as IconNameSocials } from '$lib/spritesheet-socials.ts';
	import type { IconName as IconNameApps } from '$lib/spritesheet-apps.ts';
	import type { IconName as IconNamePopup } from '$lib/spritesheet-popup.ts';
	import type { IconName as IconNameMobileNav } from '$lib/spritesheet-mobile-nav.ts';

	type IconProps =
		| { type: 'material'; icon: string; w: string; h: string; style?: string }
		| { type: 'socials'; icon: IconNameSocials; w: string; h: string; style?: string }
		| { type: 'apps'; icon: IconNameApps; w: string; h: string; style?: string }
		| { type: 'popup'; icon: IconNamePopup; w: string; h: string; style?: string }
		| { type: 'mobile-nav'; icon: IconNameMobileNav; w: string; h: string; style?: string };

	export let w: string;
	export let h: string;
	export let style: undefined | string = undefined;
	export let icon: string | IconNameApps | IconNamePopup | IconNameMobileNav | IconNameSocials;
	export let type: 'apps' | 'material' | 'mobile-nav' | 'popup' | 'socials';

	// this is AI code
	// Type assertion to make TypeScript happy
	// we want to make sure that if the type is 'material', the icon can be any string
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const props = { type, icon, w, h, style } as IconProps;

	$: formattedMaterialIcon =
		type === 'material' ? `material-symbols:${icon.replace(/_/g, '-')}-outline` : icon;

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
