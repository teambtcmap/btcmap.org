# BTC Map Development Guidelines

This file contains project-specific guidelines and commands for Claude Code to follow when working on this codebase.

## ⚠️ PRE-COMMIT CHECKLIST

**BEFORE EVERY COMMIT, YOU MUST:**

1. **🎨 Format code:** Run `yarn run format:fix` (REQUIRED - NO EXCEPTIONS)
2. **🔍 Type check:** Run `yarn run check`
3. **🧹 Lint:** Run `yarn run lint`
4. **📝 Commit format:** Use conventional commit format with issue number

**Failure to run `yarn run format:fix` before committing will result in inconsistent code formatting.**

## Additional Documentation

For comprehensive project architecture, patterns, and development workflows, see:

- [GitHub Copilot Instructions](.github/copilot-instructions.md) - Detailed project overview, framework stack, data architecture, and coding conventions

## Code Quality Commands

### Linting

```bash
yarn run lint
```

Run this command to check for TypeScript and ESLint errors. Always run this before committing changes to ensure code quality.

### Formatting

```bash
yarn run format:fix
```

Run this command to automatically format code according to project standards. Always run this before committing changes.

### Type Checking

```bash
yarn run check
```

Run this command to perform comprehensive TypeScript type checking and Svelte validation. Always run this before committing changes.

## Code Style Guidelines

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

**⚠️ CRITICAL: Always run `yarn run format:fix` before committing!**

Follow [Conventional Commits](https://www.conventionalcommits.org/) format for all commits:

```
<type>(<scope>): <description> #<issue-number>

[optional body]

🤖 Generated with [opencode](https://opencode.ai)
```

**Note:** When using opencode, we do not set a co-author attribution

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
- `chore`: Maintenance tasks

### Workflow:

1. Make your changes
2. **🎨 MANDATORY:** Run `yarn run format:fix` ⚠️ **THIS IS REQUIRED BEFORE EVERY COMMIT** ⚠️
3. Run `yarn run check` to perform type checking
4. Run `yarn run lint` to verify no errors
5. Stage and commit with conventional format
6. Include issue number if applicable (e.g., `#276`)

**🚨 CRITICAL REMINDER:** You MUST run `yarn run format:fix` before staging any commit. This is non-negotiable and ensures consistent code formatting across the entire project.

## Project Structure Notes

- `src/lib/sync/places.ts` always runs first and populates the `$places` store with `Place[]` data
- Use `Place` type for v4 API data, `Element` type for v2 API data
- Prefer editing existing files over creating new ones
- Only create documentation files when explicitly requested
