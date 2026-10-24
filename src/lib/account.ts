import { isAxiosError } from "axios";

import { API_BASE } from "#lib/api-base.js";
import { errorStatus } from "#lib/apiError.js";
import type { AuthedClient } from "#lib/authedApi.js";
import { authedClient } from "#lib/authedApi.js";
import { NOSTR_LINK_URL } from "#lib/nostr.js";

import type { ChangePasswordArgs } from "$types/btcmap-api/ChangePasswordArgs";
import type { MeResponse } from "$types/btcmap-api/MeResponse";
import type { NostrIdentityResponse } from "$types/btcmap-api/NostrIdentityResponse";
import type { UpdateUsernameArgs } from "$types/btcmap-api/UpdateUsernameArgs";

// Account settings (#1541): straight against the API as the signed-in user
// (authedApi.ts, #1348). Each call takes the caller's client when the flow
// writes the result back to the session (client.stillCurrent()). The API validates nothing on these calls; the forms bring their
// own rules (accountValidation.ts). Expected refusals come back as
// outcomes for the form to show, anything else throws.

// btcmap-api answers errors with { code, message }; a few of these calls
// only tell their refusals apart by the message.
const errorMessage = (error: unknown): string | undefined => {
	if (!isAxiosError(error)) return undefined;
	const message = (error.response?.data as { message?: unknown } | undefined)
		?.message;
	return typeof message === "string" ? message : undefined;
};

export type UsernameChange =
	| { status: "changed"; username: MeResponse["name"] }
	| { status: "taken" };

export const changeUsername = async (
	username: UpdateUsernameArgs["username"],
	client: AuthedClient = authedClient(),
): Promise<UsernameChange> => {
	const body: UpdateUsernameArgs = { username };
	try {
		const res = await client.put<MeResponse>(
			`${API_BASE}/v4/users/me/username`,
			body,
		);
		const name = res.data?.name;
		if (typeof name !== "string" || !name) {
			throw new Error("username change returned no name");
		}
		return { status: "changed", username: name };
	} catch (error) {
		// The API answers a taken name with 409 Conflict
		// (teambtcmap/btcmap-api#119)
		if (errorStatus(error) === 409) return { status: "taken" };
		throw error;
	}
};

export type PasswordChange = "changed" | "wrongPassword" | "noPassword";

export const changePassword = async (
	oldPassword: ChangePasswordArgs["old_password"],
	newPassword: ChangePasswordArgs["new_password"],
	client: AuthedClient = authedClient(),
): Promise<PasswordChange> => {
	const body: ChangePasswordArgs = {
		old_password: oldPassword,
		new_password: newPassword,
	};
	try {
		await client.put(`${API_BASE}/v4/users/me/password`, body);
		return "changed";
	} catch (error) {
		const message = errorMessage(error);
		if (message === "Invalid old password") return "wrongPassword";
		// An account created by Nostr sign-up before every account got a
		// password (teambtcmap/btcmap-api#122) has none to check against
		// until its next Nostr login
		if (message === "Invalid password hash") return "noPassword";
		throw error;
	}
};

export const fetchLinkedNpub = async (
	client: AuthedClient = authedClient(),
): Promise<NostrIdentityResponse["npub"]> => {
	const res = await client.get<NostrIdentityResponse>(NOSTR_LINK_URL);
	return typeof res.data?.npub === "string" ? res.data.npub : null;
};

export type NostrLink =
	| { status: "linked"; npub: NonNullable<NostrIdentityResponse["npub"]> }
	| { status: "taken" };

// `proof` is the base64 NIP-98 event (encodeNip98Event) signed for
// NOSTR_LINK_URL and PUT. Two credentials: the Bearer token says which
// account, the proof that the user controls the key.
export const linkNostr = async (
	proof: string,
	client: AuthedClient = authedClient(),
): Promise<NostrLink> => {
	try {
		// undefined (not null) so axios sends no body: a body would need a
		// payload-hash tag in the signed event
		const res = await client.put<NostrIdentityResponse>(
			NOSTR_LINK_URL,
			undefined,
			{ headers: { "X-Nostr-Authorization": `Nostr ${proof}` } },
		);
		const npub = res.data?.npub;
		if (typeof npub !== "string" || !npub) {
			throw new Error("nostr link returned no npub");
		}
		return { status: "linked", npub };
	} catch (error) {
		if (errorMessage(error) === "npub already linked to another account") {
			return { status: "taken" };
		}
		throw error;
	}
};

export const unlinkNostr = async (
	client: AuthedClient = authedClient(),
): Promise<void> => {
	await client.delete(NOSTR_LINK_URL);
};
