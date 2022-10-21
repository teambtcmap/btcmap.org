<script>
	import { browser } from '$app/environment';
	import {
		Header,
		Footer,
		PrimaryButton,
		LeaderboardItem,
		LeaderboardSkeleton,
		TopButton
	} from '$comp';
	import { users, userError, events, eventError, syncStatus } from '$lib/store';
	import { errToast } from '$lib/utils';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);

	let loading;
	let leaderboard;

	const leaderboardSync = (status, users, events) => {
		if (users.length && events.length && !status) {
			loading = true;
			leaderboard = [];

			users.forEach((user) => {
				let userEvents = events.filter((event) => event['user_id'] == user.id);

				if (userEvents.length) {
					let created = userEvents.filter((event) => event.type === 'create');
					let updated = userEvents.filter((event) => event.type === 'update');
					let deleted = userEvents.filter((event) => event.type === 'delete');
					let profile = user['osm_json'];
					let avatar = profile.img ? profile.img.href : '/images/satoshi-nakamoto.png';

					leaderboard.push({
						avatar: avatar,
						tagger: profile['display_name'],
						created:
							profile['display_name'] === 'Bill on Bitcoin Island'
								? created.length + 100
								: created.length,
						updated:
							profile['display_name'] === 'Bill on Bitcoin Island'
								? updated.length + 20
								: updated.length,
						deleted: deleted.length,
						tip: profile.description
					});
				}
			});

			leaderboard.sort(
				(a, b) => b.created + b.updated + b.deleted - (a.created + a.updated + a.deleted)
			);
			leaderboard = leaderboard.slice(0, 50);
			leaderboard = leaderboard;
			loading = false;
		}
	};

	$: leaderboardSync($syncStatus, $users, $events);

	const headings = ['Position', 'Supertagger', 'Created', 'Updated', 'Deleted', 'Tip'];
</script>

<div class="bg-teal">
	<Header />

	<main class="mt-10 mb-20">
		<div class="flex justify-center mb-10">
			<div id="hero" class="w-full h-[324px] flex justify-center items-end">
				<img src="/images/supertagger-king.svg" alt="ultimate supertagger" />
			</div>
		</div>

		<div class="w-10/12 xl:w-[1200px] mx-auto space-y-10">
			<h1
				class="text-center text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight"
			>
				Top Supertaggers
			</h1>

			<h2 class="text-center text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				Shadowy supertaggers are a competitive bunch. When they are not smashing the keys, they
				check this leaderboard to make sure they’re on top. Are you going to stand by and let them
				claim the top spot?! Get taggin’!
			</h2>

			<PrimaryButton
				text="Smash these numbers"
				style="w-[207px] mx-auto py-3 rounded-xl"
				link="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions#shadowy-supertaggers"
				external
			/>

			<section id="leaderboard">
				<div class="hidden lg:grid text-center grid-cols-6 mb-5">
					{#each headings as heading}
						<h3 class="text-lg font-semibold text-primary">
							{heading}
							{#if heading === 'Tip'}
								<a
									href="https://github.com/teambtcmap/btcmap-data/wiki/Lightning-Tips"
									target="_blank"
									rel="noreferrer"><i class="fa-solid fa-circle-info text-sm" /></a
								>
							{/if}
						</h3>
					{/each}
				</div>

				<div class="space-y-10 lg:space-y-5">
					{#if leaderboard && leaderboard.length && !loading}
						{#each leaderboard as item, index}
							<LeaderboardItem
								position={index + 1}
								avatar={item.avatar}
								tagger={item.tagger}
								created={item.created}
								updated={item.updated}
								deleted={item.deleted}
								tip={item.tip}
							/>
						{/each}
					{:else}
						{#each Array(50) as skeleton}
							<LeaderboardSkeleton />
						{/each}
					{/if}
				</div>

				<p class="text-sm text-center text-body">*Data updated every 10 minutes</p>

				<div class="mt-10 flex justify-center">
					<TopButton />
				</div>
			</section>

			<Footer />
		</div>
	</main>
</div>

<style>
	#hero {
		background-image: url('/images/confetti.png');
		background-repeat: no-repeat;
		background-position: center;
	}
</style>
