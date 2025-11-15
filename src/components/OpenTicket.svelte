<script lang="ts">
	import Time from 'svelte-time';

	import Icon from '$lib/components/Icon.svelte';
	import TicketLabel from '$lib/components/TicketLabel.svelte';

	export let assignees: { html_url: string; avatar_url: string; login: string }[] = [];
	export let comments: number = 0;
	export let created: string = new Date().toISOString();
	export let url: string = '';
	export let labels: { name: string; description?: string }[] = [];
	export let id: number = 0;
	export let name: string = '';
	export let user: { html_url: string; login: string } = { html_url: '', login: '' };
</script>

<div
	class="border-t-statBorder w-full items-center justify-between space-y-1 border-t p-5 text-center md:flex md:space-y-0 md:text-left"
>
	<div class="items-center space-y-1 md:flex md:space-y-0 md:space-x-2">
		<Icon type="fa" icon="ticket" w="20" h="20" style="text-xl text-link" />

		<div>
			<p>
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={url}
					target="_blank"
					rel="noreferrer"
					class="mr-1 text-lg font-semibold text-primary transition-colors hover:text-link dark:text-white dark:hover:text-link"
				>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{name}
				</a>

				<span class="block md:inline">
					{#each labels || [] as label, index (index)}
						<TicketLabel title={label?.name} tooltip={label?.description} />
					{/each}
				</span>
			</p>

			<p class="text-body dark:text-white">
				#{id} opened <Time live={3000} relative timestamp={created} />
				<br class="block md:hidden" />
				by
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={user.html_url}
					target="_blank"
					rel="noreferrer"
					class="transition-colors hover:text-link"
				>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{user.login}
				</a>
			</p>
		</div>
	</div>

	<div class="space-y-1 md:flex md:space-y-0 md:space-x-2">
		<div class="flex flex-wrap justify-center md:justify-start">
			{#each assignees || [] as assignee, index (index)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={assignee?.html_url} target="_blank" rel="noreferrer" class="mr-1 mb-1">
					<img
						src={assignee?.avatar_url}
						alt="avatar"
						title={assignee?.login}
						class="h-8 w-8 rounded-full object-cover"
					/>
				</a>
			{/each}
		</div>

		<div class="items-center md:flex">
			<Icon type="fa" icon="comment" w="16" h="16" style="text-link md:mr-1" />
			<strong class="text-primary dark:text-white">{comments}</strong>
		</div>
	</div>
</div>
