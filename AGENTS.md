# BTC Map Development Guidelines

This file contains project-specific guidelines and commands for Claude Code to follow when working on this codebase.

## ⚠️ PRE-COMMIT CHECKLIST

**BEFORE EVERY COMMIT, YOU MUST:**

1. **🎨 Format code:** Run `pnpm run format:fix` (REQUIRED - NO EXCEPTIONS)
2. **🔍 Type check:** Run `pnpm run check`
3. **🧹 Lint:** Run `pnpm run lint`
4. **🧪 Unit tests:** Run `pnpm run test --run`
5. **📝 Commit format:** Use [Conventional Commits](https://www.conventionalcommits.org/) format with issue number

**Failure to run `pnpm run format:fix` before committing will result in inconsistent code formatting.**

## Code Quality Commands

### Linting

```bash
pnpm run lint
```

Run this command to check for Biome lint errors. Always run this before committing changes to ensure code quality.

### Formatting

```bash
pnpm run format:fix
```

Run this command to automatically format code according to project standards. Always run this before committing changes.

### Type Checking

```bash
pnpm run check
```

Run this command to perform comprehensive TypeScript type checking and Svelte validation. Always run this before committing changes.

## Code Style Guidelines

### TypeScript: Prefer `type` over `interface`

- **Prefer `type` for new type definitions** - more flexible, handles unions/primitives/mapped types
- **Use `interface` only when needed** - declaration merging, or when a class must `implements` it
- **Gradually migrate** existing `interface` to `type` when touching those files

```typescript
// Preferred: type
type UserState = {
	name: string;
	isActive: boolean;
};
type ID = string | number;
type Status = 'pending' | 'active' | 'closed';

// Use interface only when necessary (e.g., class implementation)
interface Disposable {
	dispose(): void;
}
class Resource implements Disposable { ... }
```

### Imports: Separate Types from Values

- **Never mix type and value imports** in the same statement
- Use `import type { ... }` for types only (removed at compile time)
- Use `import { ... }` for values only (needed at runtime)
- This improves tree-shaking and makes code intent clearer

```typescript
// ❌ Don't mix types and values
import { merchantList, type MerchantListMode } from '$lib/merchantListStore';

// ✅ Separate type imports from value imports
import type { MerchantListMode } from '$lib/merchantListStore';
import { merchantList } from '$lib/merchantListStore';

// ✅ Type-only imports use `import type`
import type { Place, Report, AreaTags } from '$lib/types';
```

### Comments

- **Avoid JSDoc comments** (`/** */` with `@param`, `@returns`, `@description`, etc.)
- Use inline `//` comments for explaining complex logic
- Keep code self-documenting with clear variable and function names
- TypeScript types serve as documentation - explicit JSDoc is redundant

### Example:

```typescript
// ❌ Don't use JSDoc
/**
 * Updates a single place in the store
 * @param placeId - The ID of the place
 * @returns The updated place or null
 */
export const updatePlace = async (placeId: string): Promise<Place | null> => {

// ✅ Do use inline comments when needed
export const updateSinglePlace = async (placeId: string | number): Promise<Place | null> => {
	// Fetch the updated place from the API
	const response = await axios.get<Place>(...);
```

## Git Commit Guidelines

**⚠️ CRITICAL: Always run `pnpm run format:fix` before committing!**

Follow [Conventional Commits](https://www.conventionalcommits.org/) format for all commits:

```
<type>(<scope>): <description> #<issue-number>

[optional body]

🤖 Generated with [<tool>](<tool-url>)
```

Use the appropriate tool attribution based on which tool generated the commit:
- When using Claude Code: use `Co-Authored-By:` (Claude Code sets this automatically)
- When using opencode: `🤖 Generated with [opencode](https://opencode.ai)`
- When using pi: `🤖 Generated with [pi](https://github.com/mariozechner/pi-coding-agent)`

**Note:** Only Claude Code uses co-author attribution. Other tools use the `🤖 Generated with` line instead.

### Examples:

- `feat(map): add dark mode toggle #276`
- `fix(area-page): resolve TypeScript errors #345`
- `refactor(api): optimize data fetching logic #123`
- `docs(readme): update installation instructions #456`

**Note:** Use `#123` not `(#123)` or `[#123]` for issue references.

### Commit Types:

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `style`: Code style changes (formatting, etc.)
- `docs`: Documentation changes
- `test`: Test-related changes
- `ci`: CI/CD configuration changes
- `chore`: Maintenance tasks

### Workflow:

1. Make your changes
2. **🎨 MANDATORY:** Run `pnpm run format:fix` ⚠️ **THIS IS REQUIRED BEFORE EVERY COMMIT** ⚠️
3. Run `pnpm run check` to perform type checking
4. Run `pnpm run lint` to verify no errors
5. Verify the commit type matches the change (e.g., `ci` for CI changes, `feat` only for new features, not config/tooling)
6. Stage and commit with conventional format
7. Include issue number if applicable (e.g., `#276`)

**🚨 CRITICAL REMINDER:** You MUST run `pnpm run format:fix` before staging any commit. This is non-negotiable and ensures consistent code formatting across the entire project.

## i18n / Translations

When editing locale files in `src/lib/i18n/locales/*.json`:

- **Never translate proper names or usernames.** Personal names (e.g. `Nathan Day`), brand names, and online handles (e.g. `secondl1ght`, `karnage`) must be kept verbatim across all locales. Translating them produces incorrect, sometimes nonsensical output (e.g. "Nathan Dag", "tweedelig").
- **Keep keys aligned with `en.json`.** When adding or renaming keys, update every locale file so the key sets match. Missing keys silently fall back to English at runtime.
- **Use the file's existing HTML-entity style for diacritics** (`&euml;`, `&ouml;`, `&uuml;`, `&eacute;`, `&mdash;`) rather than mixing literal Unicode and entity forms within the same locale.
- **Don't translate honeypot fields.** Anti-spam honeypot inputs (the `name="honey"` fields on add-location, verify-location, communities/add, tagger-onboarding, and VerifyCommunityForm) are rendered with `class="hidden"` and never seen by humans, so translating their `placeholder` provides zero UX value while bloating every locale. Inline the placeholder as a hardcoded English string at the call site instead of referencing an i18n key.

## API Base URL

All API fetch calls use `API_BASE` from `$lib/api-base.ts` instead of hardcoding `https://api.btcmap.org`. The base URL is controlled by the `VITE_API_BASE_URL` environment variable:

- **Production / default (no env var set):** `https://api.btcmap.org`
- **Local API development:** Set `VITE_API_BASE_URL=/btcmap-api-proxy` in `.env` to route requests through the Vite dev proxy to a local `btcmap-api` on `127.0.0.1:8000`

When adding new API calls, always use `${API_BASE}/...` (imported from `$lib/api-base`) with the correct version/endpoint (e.g. `/v2/`, `/v3/`, `/v4/`, `/rpc`) — never hardcode `https://api.btcmap.org` directly.

User-facing URLs (Atom feed `href` attributes, OpenGraph image URLs) should remain hardcoded to the production API since they're rendered in HTML and must resolve publicly.

## Nostr

Profile and event data comes from arbitrary public relays — treat all of it as fully untrusted input.

### NIP Reference

Use [https://nostrhub.io/nips](https://nostrhub.io/nips) as the definitive NIP source — it includes core NIPs from the official repo plus community additions.

### Security

**CRITICAL:** Nostr private keys (`nsec`) are stored in plaintext in `localStorage`. Any JavaScript running on the origin can steal them. A single XSS means permanent, unrecoverable key theft across every Nostr client the user uses. **Treat XSS mitigation as the top-priority security concern.**

- **Sanitize event-sourced URLs.** Before binding a relay-provided URL (e.g. a kind:0 `picture`) into `src`/`href`, validate the scheme is `http(s)` — reject `javascript:`, `data:`, and unparseable values (see `safeHttpUrl` in `src/lib/nostrProfile.ts`). Keep `referrerpolicy="no-referrer"` on remote images so the page URL doesn't leak to a hostile host.
- **Never `{@html}` event content.** Bind event-sourced strings as text so Svelte escapes them, or run them through DOMPurify (`src/lib/utils.ts`) first.
- **Sanitize event-sourced strings interpolated into CSS.** A malicious `font-family` or `url()` value can break out of the CSS context and inject rules.
- **CSP is defense-in-depth**, not primary defense. Never relax it with `'unsafe-eval'`, `'unsafe-inline'` on `script-src`, or wildcard sources.
- **Filter by `authors` when trust is implied.** Nostr is permissionless — signatures prove authorship, not trustworthiness. For admin/moderator queries and addressable events (kinds 30000–39999), always constrain by trusted pubkeys. The `d` tag alone is not a trust boundary.
  ```ts
  // ❌ Anyone can publish with any d-tag value
  nostr.query([{ kinds: [30078], "#d": ["app-organizers"], limit: 1 }]);

  // ✅ Only trust admin authors
  nostr.query([{ kinds: [30078], authors: ADMIN_PUBKEYS, "#d": ["app-organizers"], limit: 1 }]);
  ```

### NIP Selection

- **Review existing NIPs first** on [nostrhub.io](https://nostrhub.io/nips). The goal is to find the closest existing solution.
- **Prefer extending existing NIPs** over creating custom kinds, even if it requires minor schema compromises. Custom kinds fragment the ecosystem.
- **When existing NIPs are close but not perfect**, use the existing kind as the base and add domain-specific tags. Document extensions in `NIP.md`.
- **Only generate a new kind** when no existing NIP covers the core functionality, the data structure is fundamentally different, or the use case needs different storage characteristics.
- **Custom kinds MUST include a NIP-31 `alt` tag** with a human-readable description.

### Kind Ranges

- **Regular** (1000 ≤ kind < 10000): stored permanently by relays. Notes, articles, etc.
- **Replaceable** (10000 ≤ kind < 20000): only the latest event per `pubkey+kind` is stored. Profile metadata (kind 0), contact lists (kind 3).
- **Addressable** (30000 ≤ kind < 40000): identified by `pubkey+kind+d-tag`; only the latest per combo is stored. Long-form content, application data.
- Kinds below 1000 are legacy regular; their storage behavior is per-kind (e.g. kind 1 is regular, kind 3 is replaceable).

### Tag Design

- **Kind = schema, tags = semantics.** Don't create new kinds just to represent a different category of the same data.
- **Relays only index single-letter tags.** Use `t` for categories so NIP-12-style filters work at the relay level. Multi-letter tags force inefficient client-side filtering.
- **Filter at the relay.** Pass tag filters in the query rather than fetching everything and filtering in JS. Combine kinds into one filter instead of running parallel queries.

### Content Field

- **Use `content` for** large freeform text or existing industry-standard JSON formats (GeoJSON, etc.). Kind 0 is the exception where structured JSON goes in `content`.
- **Use tags for** queryable metadata — anything you might filter on. If you need to filter by a field, it **must** be a tag (relays don't index content).
- **`content: ""` is idiomatic** for tag-only events.

### NIP-19 Identifiers

- **Decode NIP-19 → hex before querying** (see `toHex` in `src/lib/nostrProfile.ts`); treat an undecodable or unexpected-prefix identifier as a miss, never as raw query input. Filters only accept hex.
- Never treat `nsec1` or unknown prefixes as valid input.

## Project Structure Notes

- `src/lib/sync/places.ts` always runs first and populates the `$places` store with `Place[]` data
- Use `Place` type for v4 API data, `Element` type for v2 API data
- Prefer editing existing files over creating new ones
- Only create documentation files when explicitly requested
- **Svelte v4** — do not use Svelte v5 runes syntax (`$state`, `$derived`, `$effect`, etc.); we intentionally stay on v4
- **Tailwind v4** — uses `@tailwindcss/vite` plugin, not the v3 PostCSS setup; do not use `theme.extend` patterns from v3 docs
- **`$components` path alias** resolves to `src/components/` — use it instead of relative paths or `$lib/components`
