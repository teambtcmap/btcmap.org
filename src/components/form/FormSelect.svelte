<script lang="ts">
export let value: string | undefined = undefined;
export let id: string | undefined = undefined;
export let name: string | undefined = undefined;
export let disabled: boolean = false;
export let required: boolean = false;
export let ariaLabel: string | undefined = undefined;
export let style: string = "";
</script>

<select
	{id}
	{name}
	{disabled}
	{required}
	aria-label={ariaLabel}
	bind:value
	on:change
	class="w-full rounded-2xl border-2 border-input bg-white px-2 py-3 text-primary transition-all focus:outline-link
		disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500
		dark:bg-white/[0.15] dark:text-white dark:disabled:bg-gray-700 dark:disabled:text-gray-400
		{style}"
>
	<slot />
</select>
