import { defineEnvVars } from "@sveltejs/kit/env";

// All optional: callers check for absence and degrade (503, fallback URL),
// the same `string | undefined` the old $env/dynamic modules gave them.
// Without a schema, Kit refuses to start or build when a variable is unset.
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	SERVER_CRYPTO_KEY: { schema: optional },
	SERVER_INIT_VECTOR: { schema: optional },
	BTCMAP_IMPORT_TOKEN: { schema: optional },
	GITEA_API_URL: { schema: optional },
	GITEA_API_KEY: { schema: optional },
	PUBLIC_UMAMI_URL: { public: true, schema: optional },
});
