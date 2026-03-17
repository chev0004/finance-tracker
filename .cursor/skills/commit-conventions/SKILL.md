---
name: commit-conventions
description: Explains conventional commits with examples and when to use each type. Use when writing commit messages, suggesting commits for staged changes, or when the user asks about commit format.
---

# Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by Commitlint.

## Format

```
<type>: <subject>

[optional body]
[optional footer]
```

- **Subject**: lowercase, imperative mood. No PascalCase, Start Case, or UPPERCASE. No em dashes.
- **No scope**: Never add parentheses after the type. Use `feat: add login`, not `feat(auth): add login`.
- **No bullets** in commit messages. Write prose, not bullet lists.
- **Concise and informative**: enough context to understand the change, not exhaustive detail. Never use em dashes.

## Maximize Commits

Prefer many small, focused commits over few large ones. Split changes when sensible. Even within the same file.

**Check git diff** before suggesting commits. Inspect the diff to see if a file has multiple distinct features or fixes; if so, suggest separate commits for each (e.g. stage and commit feature A, then feature B).

**Do not group similar files**: Similar but different files (e.g. rules vs skills, or multiple rules) are separate concerns. Commit each file or logical change separately. Do not batch rules and skills, or multiple rules, into one commit just because they are similar.

**Match style**: Check `git log` for previous commit messages. Match their writing style and conciseness when suggesting new commits.

## Allowed Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, no logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system, dependencies, tooling |
| `ci` | CI config, workflows, scripts |
| `chore` | Other tasks (maintenance, config, etc.) |
| `revert` | Reverts a previous commit |

## Examples

**feat**
```
feat: add JWT login endpoint
feat: implement dark mode toggle
```

**fix**
```
fix: resolve mobile menu overflow
fix: correct date timezone in reports
```

**docs**
```
docs: update README setup instructions
docs: add endpoint documentation
```

**style**
```
style: format with Biome
style: fix trailing whitespace
```

**refactor**
```
refactor: extract shared button logic
refactor: simplify data fetching hook
```

**perf**
```
perf: memoize expensive list render
perf: add query result caching
```

**test**
```
test: add login flow tests
test: extend coverage for utils
```

**build**
```
build: upgrade Next.js to 16
build: add zod dependency
```

**ci**
```
ci: add lint job to pipeline
ci: switch to Bun for install step
```

**chore**
```
chore: update .gitignore
chore: bump lockfile
```

**revert**
```
revert: feat: add JWT login endpoint
```
