<script lang="ts">
	import { theme } from '$lib/theme';
	import { _ } from '$lib/i18n';

	export let status: 'yes' | 'no' | undefined;
	export let method: 'btc' | 'ln' | 'nfc';
	export let label: string;
	export let variant: 'default' | 'teal' = 'default';
	export let size: 'sm' | 'md' = 'sm';

	let imgElement: HTMLImageElement | undefined = undefined;
	export { imgElement as element };

	const iconPaths = {
		btc: {
			yes: { light: '/icons/btc-highlight.svg', dark: '/icons/btc-highlight-dark.svg' },
			no: {
				light: variant === 'teal' ? '/icons/btc-no-teal.svg' : '/icons/btc-no.svg',
				dark: '/icons/btc-no-dark.svg'
			},
			unknown: { light: '/icons/btc.svg', dark: '/icons/btc-dark.svg' }
		},
		ln: {
			yes: { light: '/icons/ln-highlight.svg', dark: '/icons/ln-highlight-dark.svg' },
			no: {
				light: variant === 'teal' ? '/icons/ln-no-teal.svg' : '/icons/ln-no.svg',
				dark: '/icons/ln-no-dark.svg'
			},
			unknown: { light: '/icons/ln.svg', dark: '/icons/ln-dark.svg' }
		},
		nfc: {
			yes: { light: '/icons/nfc-highlight.svg', dark: '/icons/nfc-highlight-dark.svg' },
			no: {
				light: variant === 'teal' ? '/icons/nfc-no-teal.svg' : '/icons/nfc-no.svg',
				dark: '/icons/nfc-no-dark.svg'
			},
			unknown: { light: '/icons/nfc.svg', dark: '/icons/nfc-dark.svg' }
		}
	};

	// Translation key map for payment methods
	const tooltipKeys = {
		btc: {
			yes: 'payment.onchainAccepted',
			no: 'payment.onchainNotAccepted',
			unknown: 'payment.onchainUnknown'
		},
		ln: {
			yes: 'payment.lightningAccepted',
			no: 'payment.lightningNotAccepted',
			unknown: 'payment.lightningUnknown'
		},
		nfc: {
			yes: 'payment.contactlessAccepted',
			no: 'payment.contactlessNotAccepted',
			unknown: 'payment.contactlessUnknown'
		}
	};

	$: statusKey = (status === 'yes' ? 'yes' : status === 'no' ? 'no' : 'unknown') as
		| 'yes'
		| 'no'
		| 'unknown';
	$: iconSrc =
		$theme === 'dark' ? iconPaths[method][statusKey].dark : iconPaths[method][statusKey].light;
	$: titleText = $_(tooltipKeys[method][statusKey]);
	$: sizeClass = size === 'md' ? 'h-8 w-8' : 'h-6 w-6';
</script>

<img bind:this={imgElement} src={iconSrc} alt={method} class={sizeClass} title={titleText} />
