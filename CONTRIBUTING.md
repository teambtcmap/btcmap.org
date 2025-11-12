# Contributing Guidelines

Please create an issue if there is a new feature, enhancement or bug you would like to see worked on.

If you are taking on an open issue please comment on the issue stating that you would like to work on it to avoid multiple people taking on the same issue.

## Fork the repo and submit a pull request

Please run `yarn format` after making any changes and before submitting a PR.

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) with issue numbers:

```
type: description #issue_number

- detailed change 1
- detailed change 2
```

**Examples:**

- `feat: add lightning address support #123`
- `fix: correct marker clustering on mobile #456`
- `perf: defer non-critical syncs and offload parsing to workers #490`

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

**Note:** Use `#123` not `(#123)` or `[#123]` for issue references.

That's it for now, thanks for contributing!
