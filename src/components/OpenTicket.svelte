<script>
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
	class="space-y-1 md:space-y-0 text-center md:text-left md:flex justify-between items-center w-full p-5 border-t border-t-statBorder"
>
	<div class="space-y-1 md:space-y-0 md:flex items-center md:space-x-2">
		<i class="text-xl text-link fa-solid fa-ticket" />

		<div>
			<p>
				<a
					href={url}
					target="_blank"
					rel="noreferrer"
					class="text-primary hover:text-link font-semibold text-lg transition-colors mr-1"
					>{name}</a
				>

				<span class="block md:inline">
					{#each labels as label}
						<TicketLabel title={label.name} tooltip={label.description} />
					{/each}
				</span>
			</p>

			<p class="text-body">
				#{id} opened <Time live={3000} relative timestamp={created} />
				<br class="block md:hidden" />
				by
				<a
					href={user.html_url}
					target="_blank"
					rel="noreferrer"
					class="hover:text-link transition-colors">{user.login}</a
				>
			</p>
		</div>
	</div>

	<div class="space-y-1 md:space-y-0 md:flex md:space-x-2">
		<div class="flex flex-wrap justify-center md:justify-start">
			{#each assignees as assignee}
				<a href={assignee.html_url} target="_blank" rel="noreferrer" class="mr-1 mb-1">
					<img
						src={assignee.avatar_url}
						alt="avatar"
						title={assignee.login}
						class="rounded-full w-8 h-8 object-cover"
					/>
				</a>
			{/each}
		</div>

		<div class="md:flex items-center">
			<i class="text-link fa-solid fa-comment md:mr-1" />
			<strong class="text-primary">{comments}</strong>
		</div>
	</div>
</div>
