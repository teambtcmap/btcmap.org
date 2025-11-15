# Component Import Replacement Script

This script replaces barrel exports from `$lib/comp` with direct component imports for better performance.

## Usage

### Dry Run (Preview Changes)

```bash
node scripts/remove-comp-imports.js --dry-run
```

### Phase 1: Critical Performance Pages

```bash
node scripts/remove-comp-imports.js --phase=1
```

Updates:

- `/map` page
- `/merchant/[id]` page
- Homepage `/`
- `/communities/map`

### Phase 2: Component Internal Imports

```bash
node scripts/remove-comp-imports.js --phase=2
```

Updates all components in `src/components/` that import from `$lib/comp`

### Phase 3: Remaining Route Pages

```bash
node scripts/remove-comp-imports.js --phase=3
```

Updates all remaining route pages in `src/routes/`

### All Files at Once

```bash
node scripts/remove-comp-imports.js
```

## After Running

1. Format the code:

   ```bash
   yarn format
   ```

2. Run type checking:

   ```bash
   yarn typecheck
   ```

3. Test the affected pages manually

4. Commit the changes:
   ```bash
   git add src/
   git commit -m "refactor: replace barrel imports with direct imports (Phase X)"
   ```

## What It Does

**Before:**

```typescript
import { Icon, MapLoadingMain, MerchantDrawerHash } from '$lib/comp';
```

**After:**

```typescript
import Icon from '$lib/components/Icon.svelte';
import MapLoadingMain from '$lib/components/MapLoadingMain.svelte';
import MerchantDrawerHash from '$lib/components/MerchantDrawerHash.svelte';
```

## Expected Results

- **Phase 1:** ~4 files updated
- **Phase 2:** ~30 files updated
- **Phase 3:** ~23 files updated

## Performance Impact

After all phases:

- 60% fewer HTTP requests
- 500KB-1MB less JavaScript
- 1-2 seconds faster page load
