<script lang="ts">
	import Icon from '$components/Icon.svelte';

	export let link: string | undefined = undefined;
	export let icon: string;
	export let text: string;

	const faIcons = ['x', 'instagram', 'facebook'];
	const materialIconMap: Record<string, string> = {
		compass: 'explore',
		pencil: 'edit',
		share: 'share',
		bolt: 'bolt',
		phone: 'phone',
		email: 'email',
		globe: 'language',
		external: 'open_in_new',
		tags: 'sell',
		issues: 'warning'
	};

	const faIconMap: Record<string, string> = {
		x: 'x-twitter',
		instagram: 'instagram',
		facebook: 'facebook'
	};

	$: isFaIcon = faIcons.includes(icon);
	$: resolvedIcon = isFaIcon ? faIconMap[icon] || icon : materialIconMap[icon] || icon;

	const baseClass =
		'flex h-20 w-24 items-center justify-center rounded-lg border border-primary py-1 !text-primary transition-colors hover:border-link hover:!text-link dark:border-white/95 dark:!text-white dark:hover:border-link dark:hover:!text-link';
</script>

{#if link}
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a href={link} target="_blank" rel="noopener noreferrer" class={baseClass}>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<div>
			<Icon w="30" h="30" icon={resolvedIcon} type={isFaIcon ? 'fa' : 'material'} class="mx-auto" />
			<span class="mt-1 block text-center text-xs font-semibold">{text}</span>
		</div>
	</a>
{:else}
	<button type="button" on:click class={baseClass}>
		<div>
			<Icon w="30" h="30" icon={resolvedIcon} type={isFaIcon ? 'fa' : 'material'} class="mx-auto" />
			<span class="mt-1 block text-center text-xs font-semibold">{text}</span>
		</div>
	</button>
{/if}
