# Remove Dead eslint-disable Comments

**Goal:** Remove all `eslint-disable svelte/no-navigation-without-resolve` comments across the codebase. The project uses Biome, not ESLint — these comments are dead noise.

**Scope:** 42 occurrences across 29 files (both `eslint-disable` and `eslint-enable` pairs).

**Implementation:**
1. Remove all `<!-- eslint-disable svelte/no-navigation-without-resolve -->` comments
2. Remove all `<!-- eslint-enable svelte/no-navigation-without-resolve -->` comments
3. Clean up any resulting blank lines

**Verification:**
- `yarn run format:fix && yarn run check && yarn run lint && yarn run test --run`
- Grep confirms zero remaining occurrences
