import type { PageServerLoad } from "./$types";
import type { Pleb } from "./sponsors";

const GEYSER_API = "https://api.geyser.fund/graphql";

// Users excluded from the leaderboard (platform/project accounts)
const EXCLUDED_USER_IDS = new Set(["995", "641"]); // BTC Map, Geyser

const FUNDERS_QUERY = `{
  projectGet(where: { name: "btcmap" }) {
    funders {
      amountFunded
      user {
        id
        username
        imageUrl
      }
    }
  }
}`;

const CONTRIBUTIONS_QUERY = `{
  projectGet(where: { name: "btcmap" }) {
    contributions {
      createdAt
      amount
      funder {
        user {
          id
        }
      }
    }
  }
}`;

type GeyserFunder = {
	amountFunded: number;
	user: {
		id: string;
		username: string;
		imageUrl: string | null;
	} | null;
};

type GeyserContribution = {
	createdAt: number;
	amount: number;
	funder: {
		user: { id: string } | null;
	};
};

type FundersResponse = {
	data: {
		projectGet: {
			funders: GeyserFunder[];
		};
	};
};

type ContributionsResponse = {
	data: {
		projectGet: {
			contributions: GeyserContribution[];
		};
	};
};

async function isImageUrl(
	url: string,
	fetch: typeof globalThis.fetch,
): Promise<boolean> {
	try {
		const res = await fetch(url, { method: "HEAD" });
		const contentType = res.headers.get("content-type") ?? "";
		return res.ok && contentType.startsWith("image/");
	} catch {
		return false;
	}
}

async function gql<T>(
	query: string,
	fetch: typeof globalThis.fetch,
): Promise<T | null> {
	const res = await fetch(GEYSER_API, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query }),
	});
	if (!res.ok) return null;
	return res.json();
}

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const [fundersJson, contributionsJson] = await Promise.all([
			gql<FundersResponse>(FUNDERS_QUERY, fetch),
			gql<ContributionsResponse>(CONTRIBUTIONS_QUERY, fetch),
		]);

		if (!fundersJson || !contributionsJson) {
			return { plebs: [] };
		}

		const funders = fundersJson.data?.projectGet?.funders ?? [];
		const contributions =
			contributionsJson.data?.projectGet?.contributions ?? [];

		// Named funders (pre-aggregated), excluding platform accounts
		const namedFunders = funders
			.filter(
				(f): f is GeyserFunder & { user: NonNullable<GeyserFunder["user"]> } =>
					f.user !== null && !EXCLUDED_USER_IDS.has(f.user.id),
			)
			.sort((a, b) => b.amountFunded - a.amountFunded);

		// Validate avatar URLs in parallel; fall back to robohash for missing ones
		const avatars = await Promise.all(
			namedFunders.map((f) =>
				f.user.imageUrl
					? isImageUrl(f.user.imageUrl, fetch)
					: Promise.resolve(false),
			),
		);

		const namedPlebs: Pleb[] = namedFunders.map((f, i) => ({
			name: f.user.username,
			url: `https://geyser.fund/user/${f.user.id}`,
			avatar: avatars[i]
				? (f.user.imageUrl ?? undefined)
				: `https://robohash.org/${f.user.id}?set=set1&size=64x64`,
			sats: f.amountFunded,
		}));

		// Anon contributions — each gets a unique robohash seeded by createdAt
		const anonPlebs: Pleb[] = contributions
			.filter((c) => c.funder.user === null)
			.map((c) => ({
				name: "Anon",
				avatar: `https://robohash.org/anon-${c.createdAt}?set=set1&size=64x64`,
				sats: c.amount,
			}));

		const allPlebs = [...namedPlebs, ...anonPlebs].sort(
			(a, b) => (b.sats ?? 0) - (a.sats ?? 0),
		);

		return { plebs: allPlebs };
	} catch {
		return { plebs: [] };
	}
};
