<script lang="ts">
import { _ } from "#lib/i18n/index.js";
import AreaLeaderboardPage from "$components/leaderboard/AreaLeaderboardPage.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
</script>

<AreaLeaderboardPage type="country">
	{#snippet actions()}
		<PrimaryButton style="md:w-[200px] mx-auto py-3 rounded-xl" link="/countries">
			{$_('countries.viewDirectory')}
		</PrimaryButton>
	{/snippet}
</AreaLeaderboardPage>
