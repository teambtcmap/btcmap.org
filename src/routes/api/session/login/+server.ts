import { error, json } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";

import type { RequestHandler } from "./$types";

// POST /api/session/login
// Authenticates with username + password and returns a Bearer token.
// Proxies POST /v4/users/{username}/tokens to avoid CORS preflight issues.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { username, password } = body;

	if (!username || typeof username !== "string" || username.length > 100) {
		error(400, "Missing or invalid username");
	}
	if (!password || typeof password !== "string" || password.length > 200) {
		error(400, "Missing or invalid password");
	}

	const tokenRes = await api
		.post(
			`${API_BASE}/v4/users/${encodeURIComponent(username)}/tokens`,
			{ label: "BTC Map Web" },
			{ headers: { Authorization: `Bearer ${password}` } },
		)
		.catch((err) => {
			const status = err?.response?.status;
			if (status === 401 || status === 403) {
				error(401, "Invalid username or password");
			}
			console.error("Failed to create token:", err?.response?.status);
			error(502, "Failed to log in");
		});

	const token = tokenRes.data?.token;
	if (typeof token !== "string") {
		error(502, "Token creation returned no token");
	}

	return json({ token });
};
