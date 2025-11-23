# Setup Composite Action

Shared setup steps used across all CI workflows (after checkout).

## Inputs

- `needs-env` (boolean, default: false) - Create .env file from .env.example
- `needs-sync` (boolean, default: false) - Run svelte-kit sync

## What it does

1. Sets up Node.js with yarn caching
2. Optionally creates .env file (if `needs-env: 'true'`)
3. Installs dependencies with `yarn`
4. Optionally runs `yarn svelte-kit sync` (if `needs-sync: 'true'`)

## Usage

**Important:** You must checkout the repository before using this action.

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: ./.github/actions/setup
    with:
      needs-env: 'true'
      needs-sync: 'false'
```

## Environment

All workflows using this action set `NODE_OPTIONS: --max-old-space-size=4096` to prevent OOM errors in CI.
