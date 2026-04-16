import { error, json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

// POST /api/session/signup
// Creates a throwaway BTC Map account and returns a Bearer token.
// Calls two API endpoints server-side to avoid browser CORS issues:
//   1. POST /v4/users          → create account
//   2. POST /v4/users/{name}/tokens → get Bearer token
export const POST: RequestHandler = async ({ request, fetch }) => {
	const body = await request.json();
	const password = body?.password;

	if (!password || typeof password !== "string") {
		error(400, "Missing required parameter: password");
	}

	// Step 1: Create user
	const userRes = await fetch("https://api.btcmap.org/v4/users", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ password }),
	});

	if (!userRes.ok) {
		console.error("Failed to create user:", await userRes.text());
		error(502, "Failed to create account");
	}

	const userData = await userRes.json();
	const username = userData?.name;
	if (!username) {
		error(502, "User creation returned no username");
	}

	// Step 2: Create token (password is sent as Bearer for this endpoint)
	const tokenRes = await fetch(
		`https://api.btcmap.org/v4/users/${encodeURIComponent(username)}/tokens`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${password}`,
			},
			body: JSON.stringify({}),
		},
	);

	if (!tokenRes.ok) {
		console.error("Failed to create token:", await tokenRes.text());
		error(502, "Failed to create authentication token");
	}

	const tokenData = await tokenRes.json();
	const token = tokenData?.token;
	if (!token) {
		error(502, "Token creation returned no token");
	}

	return json({ username, token });
};
