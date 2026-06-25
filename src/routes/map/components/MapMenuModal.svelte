<script lang="ts">
import Modal from "$components/Modal.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";

// Page-navigation menu, modal twin of the tools panel. Two variants mirror
// the old NavButtonsControl: "main" (/map) and "communities" (/communities/map).
export let open = false;
export let variant: "main" | "communities" = "main";

$: loggedIn = !!$session;

const rowClass =
	"flex items-center gap-3 rounded-lg px-3 py-3 text-body hover:bg-gray-100 dark:text-white dark:hover:bg-white/5";
const iconClass = "h-5 w-5 flex-none dark:invert";
</script>

<Modal bind:open title={$_("mapControls.menu")} titleId="map-menu-title">
	<nav class="space-y-1">
		<a href="/" class={rowClass} on:click={() => trackEvent("home_button_click")}>
			<img src="/icons/home.svg" alt="" class={iconClass} />
			<span>{$_("mapControls.goToHome")}</span>
		</a>

		{#if variant === "main"}
			<a
				href="/add-location"
				class={rowClass}
				on:click={() => trackEvent("add_location_click")}
			>
				<img src="/icons/marker.svg" alt="" class={iconClass} />
				<span>{$_("mapControls.addLocation")}</span>
			</a>
			<a
				href="/communities/map"
				class={rowClass}
				on:click={() => trackEvent("community_map_click")}
			>
				<img src="/icons/group.svg" alt="" class={iconClass} />
				<span>{$_("mapControls.communityMap")}</span>
			</a>
		{:else}
			<a href="/map" class={rowClass}>
				<img src="/icons/shopping.svg" alt="" class={iconClass} />
				<span>{$_("mapControls.merchantMap")}</span>
			</a>
		{/if}

		<a
			href={loggedIn ? "/user/activity" : "/login"}
			class={rowClass}
			on:click={() => trackEvent("account_button_click", { logged_in: loggedIn })}
		>
			<img src="/icons/account.svg" alt="" class={iconClass} />
			<span>{loggedIn ? $_("mapControls.account") : $_("mapControls.login")}</span>
		</a>
	</nav>
</Modal>
