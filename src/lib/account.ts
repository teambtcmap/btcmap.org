import { isAxiosError } from "axios";

import { API_BASE } from "#lib/api-base.js";
import api from "#lib/axios.js";
import { NOSTR_LINK_URL } from "#lib/nostr.js";
import { authHeaders } from "#lib/session.js";

import type { ChangePasswordArgs } from "$types/btcmap-api/ChangePasswordArgs";
import type { MeResponse } from "$types/btcmap-api/MeResponse";
import type { NostrIdentityResponse } from "$types/btcmap-api/NostrIdentityResponse";
import type { UpdateUsernameArgs } from "$types/btcmap-api/UpdateUsernameArgs";

// Account settings (#1541): straight against the API with the Bearer token
// (#1348). The API validates nothing on these calls; the forms bring their
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

// What a failed call may log: an Axios error carries the request config,
// so logging it whole would leak the Bearer token and any request body
// (passwords included). LoginForm logs the status the same way.
export const errorStatus = (error: unknown): number | undefined =>
	isAxiosError(error) ? error.response?.status : undefined;

export type UsernameChange =
	| { status: "changed"; username: MeResponse["name"] }
	| { status: "taken" };

export const changeUsername = async (
	token: string,
	username: UpdateUsernameArgs["username"],
): Promise<UsernameChange> => {
	const body: UpdateUsernameArgs = { username };
	try {
		const res = await api.put<MeResponse>(
			`${API_BASE}/v4/users/me/username`,
			body,
			authHeaders(token),
		);
		const name = res.data?.name;
		if (typeof name !== "string" || !name) {
			throw new Error("username change returned no name");
		}
		return { status: "changed", username: name };
	} catch (error) {
		// A taken name trips the UNIQUE constraint, which the API reports as
		// a generic 500 (same as signup), so a 500 here reads as "taken"
		if (errorStatus(error) === 500) return { status: "taken" };
		throw error;
	}
};

export type PasswordChange = "changed" | "wrongPassword" | "noPassword";

export const changePassword = async (
	token: string,
	oldPassword: ChangePasswordArgs["old_password"],
	newPassword: ChangePasswordArgs["new_password"],
): Promise<PasswordChange> => {
	const body: ChangePasswordArgs = {
		old_password: oldPassword,
		new_password: newPassword,
	};
	try {
		await api.put(`${API_BASE}/v4/users/me/password`, body, authHeaders(token));
		return "changed";
	} catch (error) {
		const message = errorMessage(error);
		if (message === "Invalid old password") return "wrongPassword";
		// Accounts created with Nostr have no password hash to check against,
		// so the API can't set one for them
		if (message === "Invalid password hash") return "noPassword";
		throw error;
	}
};

export const fetchLinkedNpub = async (
	token: string,
): Promise<NostrIdentityResponse["npub"]> => {
	const res = await api.get<NostrIdentityResponse>(
		NOSTR_LINK_URL,
		authHeaders(token),
	);
	return typeof res.data?.npub === "string" ? res.data.npub : null;
};

export type NostrLink =
	| { status: "linked"; npub: NonNullable<NostrIdentityResponse["npub"]> }
	| { status: "taken" };

// `proof` is the base64 NIP-98 event (encodeNip98Event) signed for
// NOSTR_LINK_URL and PUT. Two credentials: the Bearer token says which
// account, the proof that the user controls the key.
export const linkNostr = async (
	token: string,
	proof: string,
): Promise<NostrLink> => {
	try {
		// undefined (not null) so axios sends no body: a body would need a
		// payload-hash tag in the signed event
		const res = await api.put<NostrIdentityResponse>(
			NOSTR_LINK_URL,
			undefined,
			{
				headers: {
					...authHeaders(token).headers,
					"X-Nostr-Authorization": `Nostr ${proof}`,
				},
			},
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

export const unlinkNostr = async (token: string): Promise<void> => {
	await api.delete(NOSTR_LINK_URL, authHeaders(token));
};
