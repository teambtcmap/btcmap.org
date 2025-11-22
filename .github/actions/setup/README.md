# Setup Composite Action

Shared setup steps used across all CI workflows.

## Inputs

- `needs-env` (boolean, default: false) - Create .env file from .env.example
- `needs-sync` (boolean, default: false) - Run svelte-kit sync

## What it does

1. Checks out the repository
2. Sets up Node.js with yarn caching
3. Optionally creates .env file (if `needs-env: 'true'`)
4. Installs dependencies with `yarn`
5. Optionally runs `yarn svelte-kit sync` (if `needs-sync: 'true'`)

## Usage

```yaml
steps:
  - uses: ./.github/actions/setup
    with:
      needs-env: 'true'
      needs-sync: 'false'
```

## Environment

All workflows using this action set `NODE_OPTIONS: --max-old-space-size=4096` to prevent OOM errors in CI.
