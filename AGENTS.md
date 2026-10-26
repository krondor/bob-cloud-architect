# AGENTS.md

Shared operating contract for humans and agents working in this repository with the `cloud-architect` Bob mode.
Keep it short, accurate, and reviewed like code. Update it when conventions change or a recurring correction is discovered.
**Do not store secrets, personal data, or real account names here.**

---

## Purpose of this mode

This workspace provides two Bob modes:

- **`cloud-architect`** — designs production-ready cloud architectures for enterprise environments (any engagement type). Works from an approved spec; produces diagrams, component selections, security designs, integration patterns, data models, and implementation plans. No implementation code.
- **`architecture-reviewer`** — read-only well-architected review of a completed deliverable. Produces a five-pillar gap analysis and open decision entries. Does not write files or produce architecture.

The no-implementation restriction applies to the `cloud-architect` mode only; other modes follow their own instructions.

**Workspace layout:**

```
specs/          Spec-driven work: spec.md, plan.md, tasks.md, checkpoint.md per feature or system
docs/<spec-id>/ Architecture outputs produced by the agent (diagrams, decisions, models, evidence register).
                One folder per spec, named after the spec folder, e.g. docs/001-doc-processing-platform/component-matrix.md
.bob/           Bob config: custom modes, rules, MCP example
```

A `checkpoint.md` file in each spec folder records the session state so work can resume across
sessions or mode switches without re-reading the entire history: spec revision, completed
artifacts, blockers, validation status, and the next action. The agent creates it after the
first deliverable and updates it after each subsequent task completes.

---

## Spec-driven workflow

All architecture work is spec-driven. No architecture deliverable is produced until a spec exists and a human has approved its requirements.

1. **Specify** (`specs/<NNN-name>/spec.md`): business requirements, goals, scope, constraints, risks, and testable acceptance criteria. The human owns the requirements. If no spec exists, the agent may draft one from the user's request (status `draft`, approval `pending`, unknowns listed as open decisions); only a human sets approval.
2. **Plan** (`specs/<NNN>/plan.md`): architecture approach, cloud selection rationale, integration targets, security posture, open decisions.
3. **Tasks** (`specs/<NNN>/tasks.md`): ordered deliverable checklist — each item one reviewable output (e.g. high-level diagram, component matrix, security design).
4. **Produce**: one deliverable at a time, grounded in the spec.
5. **Verify**: map every spec acceptance criterion to evidence before closing the spec.

The agent selects the spec the user names (or the only non-accepted one) before beginning any session. If none exists, it drafts one for approval. Status values: `draft`, `in-progress`, `ready-for-review`, `accepted`. Approval is a separate `Requirements approval` field recorded against a spec revision; a material change resets it to `pending`.

---

## Required tools

<!-- TODO: Fill in the tools and versions your workspace standardizes on. -->

| Tool | Minimum version | Notes |
|---|---|---|
| `node` | `>= 18` | Required to run `scripts/install.mjs` |

---

## Grounding sources

The agent grounds architecture decisions in current cloud documentation. When MCP documentation servers are configured, it uses them before recommending any service. When they are not configured, it cites the docs URL it is relying on.

MCP servers (optional): copy `.bob/mcp.json.example` to `.bob/mcp.json` and configure credentials. `.bob/mcp.json` is git-ignored — do not commit it.

<!-- TODO: If your organization has additional approved reference sources (internal wikis, ADRs,
     approved service lists, approved regions), list them here so the agent grounds against them. -->

---

## Git and review conventions

<!-- TODO: Update with your organization's branching and review rules. -->

- **Branch naming:** `<type>/<spec-id>-<slug>` (e.g. `feat/001-event-platform-arch`).
- **No direct commits to `main`.** Open a PR for every change, including spec updates.
- **Commit style:** Conventional Commits referencing the spec and task id.
- **PR description must include:** spec link, tasks covered, evidence, open decisions.
- **Minimum approvers:** `<!-- TODO: e.g. 1 architect peer review before any deliverable is finalized -->`.
- Peers review the spec before the deliverables. Leave handoff notes in the spec folder.

---

## Security rules

- No secrets, credentials, account identifiers, or PII in specs, diagrams, or agent context.
- Architecture designs must not assume any cloud credentials are available to the agent.
- All security design outputs are reviewed by a human before being treated as approved.
- `<!-- TODO: add your organization's additional security and compliance requirements -->`.

---

## Skills

Load with `use_skill` when the task needs them. See `CONTRIBUTING.md` for how to add or update skills.

| Skill | Location | When to use |
|---|---|---|
| `cloud-architecture-patterns` | `.bob/skills/cloud-architecture-patterns/SKILL.md` | Pattern selection, anti-patterns, cloud service mappings, integration patterns, HA/DR and cost reference |
| `data-architecture-patterns` | `.bob/skills/data-architecture-patterns/SKILL.md` | Spec involves analytical data, lakehouse, streaming analytics, data mesh, catalog or data governance |
| `genai-architecture` | `.bob/skills/genai-architecture/SKILL.md` | Spec involves LLMs, RAG, agents, model access, AI safety or evaluation (not batch document summarisation alone; see the profile) |
| `iac-and-delivery-planning` | `.bob/skills/iac-and-delivery-planning/SKILL.md` | Planning IaC tool choice, state/module/environment strategy, policy-as-code, landing-zone structure, CI/CD and supply-chain controls (design level, no code) |
| `well-architected-review` | `.bob/skills/well-architected-review/SKILL.md` | Reviewing a completed deliverable against the five-pillar WAF before handoff |
| `document-processing-profile` | `.bob/skills/document-processing-profile/SKILL.md` | Spec declares `profile: document-processing` — adds pipeline patterns, DDL, LLM rules, and review checks |

---

## Definition of done

An architecture task is done when:

- [ ] The spec acceptance criteria are mapped to evidence in the deliverable.
- [ ] All cloud targets named in the spec are covered with equal depth.
- [ ] Every integration target has an explicit auth model and data contract documented.
- [ ] Security design covers IAM, encryption, secrets, and audit logging.
- [ ] A human has reviewed and approved the deliverable before it moves downstream.
- [ ] `<!-- TODO: add your organization's additional DoD items -->`.
