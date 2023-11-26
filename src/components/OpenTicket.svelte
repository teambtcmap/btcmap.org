<script lang="ts">
	import Time from 'svelte-time';

	import { TicketLabel } from '$comp';

	export let assignees;
	export let comments;
	export let created;
	export let url;
	export let labels;
	export let id;
	export let name;
	export let user;
</script>

<div
	class="w-full items-center justify-between space-y-1 border-t border-t-statBorder p-5 text-center md:flex md:space-y-0 md:text-left"
>
	<div class="items-center space-y-1 md:flex md:space-x-2 md:space-y-0">
		<i class="fa-solid fa-ticket text-xl text-link" />

		<div>
			<p>
				<a
					href={url}
					target="_blank"
					rel="noreferrer"
					class="mr-1 text-lg font-semibold text-primary transition-colors hover:text-link dark:text-white dark:hover:text-link"
					>{name}</a
				>

				<span class="block md:inline">
					{#each labels as label}
						<TicketLabel title={label.name} tooltip={label.description} />
					{/each}
				</span>
			</p>

			<p class="text-body dark:text-white">
				#{id} opened <Time live={3000} relative timestamp={created} />
				<br class="block md:hidden" />
				by
				<a
					href={user.html_url}
					target="_blank"
					rel="noreferrer"
					class="transition-colors hover:text-link">{user.login}</a
				>
			</p>
		</div>
	</div>

	<div class="space-y-1 md:flex md:space-x-2 md:space-y-0">
		<div class="flex flex-wrap justify-center md:justify-start">
			{#each assignees as assignee}
				<a href={assignee.html_url} target="_blank" rel="noreferrer" class="mb-1 mr-1">
					<img
						src={assignee.avatar_url}
						alt="avatar"
						title={assignee.login}
						class="h-8 w-8 rounded-full object-cover"
					/>
				</a>
			{/each}
		</div>

		<div class="items-center md:flex">
			<i class="fa-solid fa-comment text-link md:mr-1" />
			<strong class="text-primary dark:text-white">{comments}</strong>
		</div>
	</div>
</div>
