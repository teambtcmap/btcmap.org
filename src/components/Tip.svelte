<script lang="ts">
	import { TipType } from '$lib/types';

	export let user: undefined | string = undefined;
	export let destination: string;
	export let style: undefined | string = undefined;
	export let type: TipType = TipType.Address;
</script>

{#if user}
	<div class="!my-12">
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={type === 'url' ? destination : `lightning:${destination}`}
			target={type === 'url' ? '_blank' : null}
			rel={type === 'url' ? 'noreferrer' : null}
			class="w-full rounded-xl bg-link p-3 px-5 text-center font-semibold text-white transition-colors hover:bg-hover md:text-lg"
		>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<!--  lightning icon -->
			<svg
				class="hidden h-7 w-7 md:inline"
				width="16"
				height="17"
				viewBox="0 0 16 17"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M8.66674 1.83334L2.72904 8.95858C2.4965 9.23763 2.38023 9.37715 2.37846 9.49498C2.37691 9.59742 2.42256 9.69488 2.50224 9.75927C2.5939 9.83334 2.77552 9.83334 3.13876 9.83334H8.00007L7.3334 15.1667L13.2711 8.04144C13.5036 7.7624 13.6199 7.62287 13.6217 7.50504C13.6232 7.4026 13.5776 7.30514 13.4979 7.24075C13.4062 7.16668 13.2246 7.16668 12.8614 7.16668H8.00007L8.66674 1.83334Z"
					stroke="currentColor"
					stroke-width="1.41667"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			Tip {user}
		</a>
	</div>
{:else}
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href={type === 'url' ? destination : `lightning:${destination}`}
		target={type === 'url' ? '_blank' : null}
		rel={type === 'url' ? 'noreferrer' : null}
		class="w-full rounded-lg border border-link py-2 text-center text-sm font-semibold text-link hover:border-white hover:bg-link hover:text-white md:w-20 md:py-1 {style} transition-colors"
	>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<!--  lightning icon -->
		<svg
			class="inline"
			width="16"
			height="17"
			viewBox="0 0 16 17"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M8.66674 1.83334L2.72904 8.95858C2.4965 9.23763 2.38023 9.37715 2.37846 9.49498C2.37691 9.59742 2.42256 9.69488 2.50224 9.75927C2.5939 9.83334 2.77552 9.83334 3.13876 9.83334H8.00007L7.3334 15.1667L13.2711 8.04144C13.5036 7.7624 13.6199 7.62287 13.6217 7.50504C13.6232 7.4026 13.5776 7.30514 13.4979 7.24075C13.4062 7.16668 13.2246 7.16668 12.8614 7.16668H8.00007L8.66674 1.83334Z"
				stroke="currentColor"
				stroke-width="1.41667"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		Tip
	</a>
{/if}
