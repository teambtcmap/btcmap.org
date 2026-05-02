import type { PageServerLoad } from "./$types";
import type { Pleb } from "./sponsors";

const GEYSER_API = "https://api.geyser.fund/graphql";

// Users excluded from the leaderboard (platform/project accounts)
const EXCLUDED_USER_IDS = new Set(["995", "641"]); // BTC Map, Geyser

// Allowlisted hostnames for avatar images — only URLs from these hosts are
// passed to the client. This avoids server-side fetching of arbitrary
// user-controlled URLs (SSRF).
const AVATAR_ALLOWLIST = new Set([
	"storage.googleapis.com",
	"pbs.twimg.com",
	"abs.twimg.com",
	"avatars.githubusercontent.com",
	"cdn.nostr.build",
	"nostr.build",
	"image.nostr.build",
	"primal.b-cdn.net",
	"media.tenor.com",
]);

function isAllowlistedImageUrl(url: string | null): boolean {
	if (!url) return false;
	try {
		const { protocol, hostname } = new URL(url);
		if (protocol !== "https:") return false;
		return AVATAR_ALLOWLIST.has(hostname);
	} catch {
		return false;
	}
}

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

const REQUEST_TIMEOUT_MS = 6000;

async function gql<T>(
	query: string,
	fetch: typeof globalThis.fetch,
): Promise<T | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const res = await fetch(GEYSER_API, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query }),
			signal: controller.signal,
		});
		if (!res.ok) return null;
		return res.json();
	} finally {
		clearTimeout(timeout);
	}
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

		const namedPlebs: Pleb[] = namedFunders.map((f) => ({
			id: f.user.id,
			name: f.user.username,
			url: `https://geyser.fund/user/${f.user.id}`,
			avatar: isAllowlistedImageUrl(f.user.imageUrl)
				? (f.user.imageUrl ?? undefined)
				: `https://robohash.org/${f.user.id}?set=set1&size=64x64`,
			sats: f.amountFunded,
		}));

		// Anon contributions — index is appended to createdAt to guarantee unique IDs
		const anonPlebs: Pleb[] = contributions
			.filter((c) => c.funder.user === null)
			.map((c, i) => ({
				id: `anon-${c.createdAt}-${i}`,
				name: "Anon",
				avatar: `https://robohash.org/anon-${c.createdAt}-${i}?set=set1&size=64x64`,
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
