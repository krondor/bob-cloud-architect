# Contributing to bob-cloud-architect

Thank you for improving this mode. This guide covers git-based contributions — for local-only customization without git, see [README.md](README.md).

## What belongs here

Good contributions to this repo:

- **Rules improvements** — corrections, additions, or restructuring of files in `.bob/rules-cloud-architect/`
- **New rules domains** — a new numbered rules file for a gap in the current coverage (e.g. cost optimization, multi-region patterns)
- **AGENTS.md template improvements** — better placeholder text, missing placeholder sections, clearer TODO guidance
- **Installer fixes** — bug fixes or new flags in `scripts/install.mjs`
- **Spec template improvements** — clearer acceptance criteria, missing sections in `specs/TEMPLATE/spec.md`
- **MCP configuration corrections** — updated server names, added required args, corrected documentation links

What does **not** belong here:

- Org-specific or client-specific content (endpoints, account IDs, internal system names)
- Secrets or credentials of any kind
- Changes to `.bob/mcp.json` (that file is git-ignored by design — it stays local)

## Branching

Branch from `main`. Use a short, descriptive branch name:

```
feat/add-cost-optimization-rules
fix/mcp-gcp-server-args
docs/clarify-agents-md-placeholders
```

Prefix conventions: `feat/` for new capability, `fix/` for corrections, `docs/` for documentation-only changes, `refactor/` for restructuring without behavior change.

## Commit messages

Use the conventional commits format:

```
<type>(<scope>): <short summary>

[optional body]
```

Types: `feat`, `fix`, `docs`, `refactor`, `chore`  
Scope: the affected area — `rules`, `installer`, `agents-md`, `spec`, `mcp`, `mode-yaml`

Examples:
```
feat(rules): add 07-cost-optimization rules file
fix(installer): handle missing .bob directory on first install
docs(agents-md): improve TODO placeholder text for integration targets
```

Keep the summary under 72 characters. Use the body to explain *why*, not *what*.

## Pull request scope

Keep PRs focused. One logical change per PR. A PR that adds a new rules file and also fixes the installer is two PRs.

Include in the PR description:
- What changed and why
- How to verify the change (e.g. "Install into a test workspace with `--dry-run` and confirm output")
- Whether the change affects the dispatch table in `custom_modes.yaml` (if yes, confirm it was updated)

## Adding a rules file

1. Create `.bob/rules-cloud-architect/NN-<name>.md` using the next available two-digit prefix.
2. Start the file with `<!-- load when: <condition> -->` on the first line.
3. Add a matching entry to the dispatch table in `.bob/custom_modes.yaml` under `customInstructions` — without this, the agent will never load the file.
4. Include the new file in your PR with a brief explanation of what gap it fills.

## Adding or updating a skill

Skills in this repo are vendored — the `SKILL.md` file is committed directly. To add one:

1. Place the file at `.bob/skills/<skill-name>/SKILL.md`.
2. Add an entry to `skills-lock.json` under `"skills"` with the skill name, source URL, and version or commit hash.
3. Add a row to the **Skills** table in `AGENTS.md`.
4. Include a comment in the PR about where the skill came from and why it adds value to this mode.

To update a vendored skill, replace the file and update the `skills-lock.json` entry. Do not edit a vendored skill's content directly — update from source and commit the new version.

## Validation before opening a PR

```bash
npm install   # first time only; installs the `yaml` dependency used by the installer and tests
npm test      # installer regression tests, skill/lock version sync, and package contents
```

Tests live in `test/` and are repo-only: the `files` allowlist in `package.json` keeps them out of the published package, and the installer never copies them into a client workspace. Add a test in `test/install.test.mjs` for any installer change.

If you added or modified a rules file, open the mode in Bob against the `specs/001-doc-processing-platform/spec.md` example and confirm the agent loads the new file at the expected point in the session.

## Review expectations

PRs are reviewed for:
- Accuracy of any cloud service, IaC, or security claims in rules files
- Consistency with the existing rules style (concise, prescriptive, no prose padding)
- Correct `<!-- load when: ... -->` header on any new rules file
- Dispatch table updated if a new rules file was added
- No org-specific or client-specific content
- `skills-lock.json` updated if a skill was added or changed
