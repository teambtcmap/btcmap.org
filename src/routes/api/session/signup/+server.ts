import { error, json } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "$lib/passwordPolicy";

import type { RequestHandler } from "./$types";

// POST /api/session/signup
// Creates a BTC Map account and returns a Bearer token. Both name and
// password are required: the API's optional-name mode (random username)
// is no longer exposed since throwaway accounts were retired. Calls two
// API endpoints server-side to avoid browser CORS issues:
//   1. POST /v4/users              → create account
//   2. POST /v4/users/{name}/tokens → get Bearer token
export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: { name?: unknown; password?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, "Invalid JSON body");
	}
	if (!body || typeof body !== "object") {
		error(400, "Invalid request body");
	}
	const password = body.password;

	// Upper bound as in the login route; the minimum mirrors the signup form's
	// policy so a direct request can't create a weak-password account.
	if (
		!password ||
		typeof password !== "string" ||
		password.length < PASSWORD_MIN_LENGTH ||
		password.length > PASSWORD_MAX_LENGTH
	) {
		error(400, "Missing or invalid password");
	}

	const name = typeof body.name === "string" ? body.name.trim() : "";
	if (!name || name.length > 100) {
		error(400, "Missing or invalid name");
	}

	let userRes: Response;
	try {
		// Step 1: Create user
		userRes = await fetch(`${API_BASE}/v4/users`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, password }),
		});
	} catch (err) {
		console.error("Failed to create user:", err);
		error(502, "Failed to create account");
	}

	if (!userRes.ok) {
		const detail = await userRes.text();
		console.error("Failed to create user:", detail);
		error(userRes.status, "Failed to create account");
	}

	let userData: { name?: unknown };
	try {
		userData = (await userRes.json()) as { name?: unknown };
	} catch (err) {
		console.error("Failed to parse user response:", err);
		error(502, "Failed to create account");
	}
	const username = userData?.name;
	if (!username || typeof username !== "string") {
		error(502, "User creation returned no username");
	}

	let tokenRes: Response;
	try {
		// Step 2: Create token (password is sent as Bearer for this endpoint)
		tokenRes = await fetch(
			`${API_BASE}/v4/users/${encodeURIComponent(username)}/tokens`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${password}`,
				},
				body: JSON.stringify({ label: "BTC Map Web" }),
			},
		);
	} catch (err) {
		console.error("Failed to create token:", err);
		error(502, "Failed to create authentication token");
	}

	if (!tokenRes.ok) {
		console.error("Failed to create token:", await tokenRes.text());
		error(tokenRes.status, "Failed to create authentication token");
	}

	let tokenData: { token?: unknown };
	try {
		tokenData = (await tokenRes.json()) as { token?: unknown };
	} catch (err) {
		console.error("Failed to parse token response:", err);
		error(502, "Failed to create authentication token");
	}
	const token = tokenData?.token;
	if (!token || typeof token !== "string") {
		error(502, "Token creation returned no token");
	}

	return json({ username, token });
};
