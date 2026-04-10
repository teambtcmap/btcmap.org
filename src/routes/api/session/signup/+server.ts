import { error, json } from "@sveltejs/kit";

import api from "$lib/axios";

import type { RequestHandler } from "./$types";

// POST /api/session/signup
// Creates a throwaway BTC Map account and returns a Bearer token.
// Calls two API endpoints server-side to avoid browser CORS issues:
//   1. POST /v4/users          → create account
//   2. POST /v4/users/{name}/tokens → get Bearer token
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const password = body?.password;

	if (!password || typeof password !== "string") {
		error(400, "Missing required parameter: password");
	}

	// Step 1: Create user
	const userRes = await api
		.post("https://api.btcmap.org/v4/users", { password })
		.catch((err) => {
			console.error("Failed to create user:", err?.response?.data ?? err);
			error(502, "Failed to create account");
		});

	const username = userRes.data?.name;
	if (!username) {
		error(502, "User creation returned no username");
	}

	// Step 2: Create token (password is sent as Bearer for this endpoint)
	const tokenRes = await api
		.post(
			`https://api.btcmap.org/v4/users/${encodeURIComponent(username)}/tokens`,
			{},
			{ headers: { Authorization: `Bearer ${password}` } },
		)
		.catch((err) => {
			console.error("Failed to create token:", err?.response?.data ?? err);
			error(502, "Failed to create authentication token");
		});

	const token = tokenRes.data?.token;
	if (!token) {
		error(502, "Token creation returned no token");
	}

	return json({ username, token });
};
