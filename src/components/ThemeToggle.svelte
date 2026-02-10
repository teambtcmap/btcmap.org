<script lang="ts">
	import { theme } from '$lib/theme';
</script>

<button
	on:click={() => theme.toggle()}
	aria-label={$theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
	title={$theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
	class="h-10 w-10 text-link transition-colors hover:text-hover dark:text-white dark:hover:text-link"
>
	{#if $theme === 'dark'}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			data-v-4fa90e7f=""
			><path d="M20.993 13.313a6 6 0 01-7.306-7.306 7 7 0 107.306 7.306z" /><path
				fill-rule="evenodd"
				d="M4.5 8.25a.5.5 0 01.5.5v1.5a.5.5 0 01-1 0v-1.5a.5.5 0 01.5-.5z"
				clip-rule="evenodd"
			/><path
				fill-rule="evenodd"
				d="M3.25 9.5a.5.5 0 01.5-.5h1.5a.5.5 0 010 1h-1.5a.5.5 0 01-.5-.5zM7.5 3a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5z"
				clip-rule="evenodd"
			/><path
				fill-rule="evenodd"
				d="M6 4.5a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5z"
				clip-rule="evenodd"
			/></svg
		>
	{:else if $theme === 'light'}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			data-v-4fa90e7f=""
			><path
				d="M12 16.5A4.505 4.505 0 017.5 12c0-2.481 2.019-4.5 4.5-4.5s4.5 2.019 4.5 4.5-2.019 4.5-4.5 4.5z"
			/><path
				fill-rule="evenodd"
				d="M12 3a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2A.5.5 0 0112 3zM18 12a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5zM3 12a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2A.5.5 0 013 12zM12 18a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5zM18.354 5.646a.5.5 0 010 .708l-1.5 1.5a.5.5 0 01-.708-.708l1.5-1.5a.5.5 0 01.708 0zM7.854 16.146a.5.5 0 010 .708l-1.5 1.5a.5.5 0 01-.708-.708l1.5-1.5a.5.5 0 01.708 0zM5.646 5.646a.5.5 0 01.708 0l1.5 1.5a.5.5 0 11-.708.708l-1.5-1.5a.5.5 0 010-.708zM16.146 16.146a.5.5 0 01.708 0l1.5 1.5a.5.5 0 01-.708.708l-1.5-1.5a.5.5 0 010-.708z"
				clip-rule="evenodd"
			/></svg
		>
	{/if}
</button>
