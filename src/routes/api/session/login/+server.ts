import { error, json } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";

import type { RequestHandler } from "./$types";

// POST /api/session/login
// Authenticates with username + password and returns a Bearer token.
// Proxies POST /v4/users/{username}/tokens to avoid CORS preflight issues.
export const POST: RequestHandler = async ({ request, fetch }) => {
	const body = await request.json();
	const { username, password } = body;

	if (!username || typeof username !== "string" || username.length > 100) {
		error(400, "Missing or invalid username");
	}
	if (!password || typeof password !== "string" || password.length > 200) {
		error(400, "Missing or invalid password");
	}

	let tokenRes: Response;
	try {
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
		error(502, "Failed to log in");
	}

	if (!tokenRes.ok) {
		if (tokenRes.status === 401 || tokenRes.status === 403) {
			error(401, "Invalid username or password");
		}
		console.error("Failed to create token:", tokenRes.status);
		error(502, "Failed to log in");
	}

	const tokenData = await tokenRes.json();
	const token = tokenData?.token;
	if (typeof token !== "string") {
		error(502, "Token creation returned no token");
	}

	return json({ token });
};
