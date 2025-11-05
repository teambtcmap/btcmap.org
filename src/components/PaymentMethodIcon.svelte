<script lang="ts">
	import { detectTheme } from '$lib/utils';

	export let status: 'yes' | 'no' | undefined;
	export let method: 'btc' | 'ln' | 'nfc';
	export let label: string;

	const getTheme = detectTheme;

	const iconPaths = {
		btc: {
			yes: { light: '/icons/btc-highlight.svg', dark: '/icons/btc-highlight-dark.svg' },
			no: { light: '/icons/btc-no.svg', dark: '/icons/btc-no-dark.svg' },
			unknown: { light: '/icons/btc.svg', dark: '/icons/btc-dark.svg' }
		},
		ln: {
			yes: { light: '/icons/ln-highlight.svg', dark: '/icons/ln-highlight-dark.svg' },
			no: { light: '/icons/ln-no.svg', dark: '/icons/ln-no-dark.svg' },
			unknown: { light: '/icons/ln.svg', dark: '/icons/ln-dark.svg' }
		},
		nfc: {
			yes: { light: '/icons/nfc-highlight.svg', dark: '/icons/nfc-highlight-dark.svg' },
			no: { light: '/icons/nfc-no.svg', dark: '/icons/nfc-no-dark.svg' },
			unknown: { light: '/icons/nfc.svg', dark: '/icons/nfc-dark.svg' }
		}
	};

	const isDark = getTheme() === 'dark';
	$: statusKey = status === 'yes' ? 'yes' : status === 'no' ? 'no' : 'unknown';
	$: iconSrc = isDark ? iconPaths[method][statusKey].dark : iconPaths[method][statusKey].light;
	$: titleText =
		status === 'yes'
			? `${label} accepted`
			: status === 'no'
				? `${label} not accepted`
				: `${label} unknown`;
</script>

<img src={iconSrc} alt={method} class="h-6 w-6" title={titleText} />
