<script lang="ts">
	import IconIconify from '@iconify/svelte';

	import type { IconName as IconNameSocials } from '$lib/spritesheet-socials.ts';
	import type { IconName as IconNameApps } from '$lib/spritesheet-apps.ts';
	import type { IconName as IconNamePopup } from '$lib/spritesheet-popup.ts';
	import type { IconName as IconNameMobileNav } from '$lib/spritesheet-mobile-nav.ts';

	type IconProps =
		| { type: 'material'; icon: string; w: string; h: string; style?: string }
		| { type: 'fa'; icon: string; w: string; h: string; style?: string }
		| { type: 'socials'; icon: IconNameSocials; w: string; h: string; style?: string }
		| { type: 'apps'; icon: IconNameApps; w: string; h: string; style?: string }
		| { type: 'popup'; icon: IconNamePopup; w: string; h: string; style?: string }
		| { type: 'mobile-nav'; icon: IconNameMobileNav; w: string; h: string; style?: string };

	export let w: string;
	export let h: string;
	export let style: undefined | string = undefined;
	export let icon: string | IconNameApps | IconNamePopup | IconNameMobileNav | IconNameSocials;
	export let type: 'apps' | 'fa' | 'material' | 'mobile-nav' | 'popup' | 'socials' = 'material';

	// this is AI code
	// Type assertion to make TypeScript happy
	// we want to make sure that if the type is 'material', the icon can be any string
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const props = { type, icon, w, h, style } as IconProps;

	$: formattedIconifyIcon =
		type === 'material'
			? (() => {
					// Handle exceptions for specific icons
					const exceptions: Record<string, string> = {
						// map icons
						camping: 'material-symbols:camping-rounded',
						gate: 'material-symbols:gate',
						cooking: 'material-symbols:cooking',
						dentistry: 'material-symbols:dentistry',
						sauna: 'material-symbols:sauna',
						info_outline: 'material-symbols:info-outline',
						skull: 'material-symbols:skull',
						currency_bitcoin: 'material-symbols:currency-bitcoin',

						// general app icons
						close_round: 'ic:round-close'
					};

					// Check if this icon has an exception
					if (exceptions[icon as string]) {
						return exceptions[icon as string];
					}

					// Default handling
					return `ic:outline-${(icon as string).replace(/_/g, '-')}`;
				})()
			: type === 'fa'
				? `fa6-solid:${icon as string}`
				: icon;

	$: spriteHref =
		{
			socials: '/icons/spritesheet-socials.svg',
			apps: '/icons/spritesheet-apps.svg',
			popup: '/icons/spritesheet-popup.svg',
			'mobile-nav': '/icons/spritesheet-mobile-nav.svg'
		}[type as Exclude<typeof type, 'material' | 'fa'>] || '';
</script>

{#if type === 'material' || type === 'fa'}
	<IconIconify icon={formattedIconifyIcon} width={w} height={h} class={style} />
{:else}
	<svg width="{w}px" height="{h}px" class={style}>
		<use width="{w}px" height="{h}px" href={`${spriteHref}#${icon}`} />
	</svg>
{/if}
