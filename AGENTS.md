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

## API Base URL

All API fetch calls use `API_BASE` from `$lib/api-base.ts` instead of hardcoding `https://api.btcmap.org`. The base URL is controlled by the `VITE_API_BASE_URL` environment variable:

- **Production / default (no env var set):** `https://api.btcmap.org`
- **Local API development:** Set `VITE_API_BASE_URL=/btcmap-api-proxy` in `.env` to route requests through the Vite dev proxy to a local `btcmap-api` on `127.0.0.1:8000`

When adding new API calls, always use `${API_BASE}/v4/...` (imported from `$lib/api-base`) — never hardcode `https://api.btcmap.org` directly.

User-facing URLs (Atom feed `href` attributes, OpenGraph image URLs) should remain hardcoded to the production API since they're rendered in HTML and must resolve publicly.

## Project Structure Notes

- `src/lib/sync/places.ts` always runs first and populates the `$places` store with `Place[]` data
- Use `Place` type for v4 API data, `Element` type for v2 API data
- Prefer editing existing files over creating new ones
- Only create documentation files when explicitly requested
- **Svelte v4** — do not use Svelte v5 runes syntax (`$state`, `$derived`, `$effect`, etc.); we intentionally stay on v4
- **Tailwind v4** — uses `@tailwindcss/vite` plugin, not the v3 PostCSS setup; do not use `theme.extend` patterns from v3 docs
- **`$components` path alias** resolves to `src/components/` — use it instead of relative paths or `$lib/components`
