<script lang="ts">
	import Icon from '$components/Icon.svelte';
	import type { IssueIcon } from '$lib/types';

	export let icon: IssueIcon | string;

	const iconMap: Record<string, string> = {
		'fa-calendar-days': 'calendar-days',
		'fa-clipboard-question': 'clipboard-question',
		'fa-hourglass-end': 'hourglass-end',
		'fa-icons': 'icons',
		'fa-list-check': 'list-check',
		'fa-spell-check': 'spell-check',
		'fa-hourglass-half': 'hourglass-half'
	};

	$: faIcon = iconMap[icon] || 'question';
</script>

<div class="w-3 shrink-0">
	<Icon type="fa" icon={faIcon} w="12" h="12" />
</div>
