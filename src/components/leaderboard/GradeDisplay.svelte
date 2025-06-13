<script lang="ts">
	export let grade: number = 0;
	export let percentage: number | undefined = undefined;
	export let avgDate: string | undefined = undefined;
	export let size: 'small' | 'medium' | 'large' = 'medium';
	export let showTooltip: boolean = true;

	const sizeClasses = {
		small: 'text-sm',
		medium: 'text-base',
		large: 'text-lg'
	};

	// Svelte action for grade tooltips
	function gradeTooltipAction(node: HTMLElement, data: { percentage?: number; avgDate?: string }) {
		// Tippy instance - using object with destroy method since tippy.js types are complex with dynamic imports
		let instance: { destroy(): void } | undefined;

		async function setup() {
			if (showTooltip && data.percentage !== undefined) {
				// Dynamic import for tippy.js to avoid SSR issues
				const { default: tippy } = await import('tippy.js');

				let content = `${data.percentage.toFixed(1)}% up-to-date`;

				if (data.avgDate) {
					const verificationDate = new Date(data.avgDate);
					const now = new Date();
					const diffTime = now.getTime() - verificationDate.getTime();
					const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
					content += `<br>Average verification: ${diffDays} days ago`;
				}

				instance = tippy(node, {
					content,
					allowHTML: true
				});
			}
		}

		function cleanup() {
			if (instance) {
				instance.destroy();
				instance = undefined;
			}
		}

		setup();

		return {
			update(newData: { percentage?: number; avgDate?: string }) {
				cleanup();
				data = newData;
				setup();
			},
			destroy() {
				cleanup();
			}
		};
	}
</script>

{#if grade > 0}
	<div
		class="cursor-help font-semibold text-primary dark:text-white {sizeClasses[size]}"
		class:flex={size === 'large'}
		class:justify-center={size === 'large'}
		role="img"
		aria-label="{grade} out of 5 stars{percentage ? `, ${percentage.toFixed(1)}% up-to-date` : ''}"
		use:gradeTooltipAction={{ percentage, avgDate }}
	>
		{'★'.repeat(grade)}{'☆'.repeat(5 - grade)}
	</div>
{:else}
	<span class="text-primary dark:text-white {sizeClasses[size]}">N/A</span>
{/if}
