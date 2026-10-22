# AGENTS.md

Shared operating contract for humans and agents working in this repository with the `cloud-architect` Bob mode.
Keep it short, accurate, and reviewed like code. Update it when conventions change or a recurring correction is discovered.
**Do not store secrets, personal data, or real account names here.**

---

## Purpose of this mode

This workspace uses the `cloud-architect` Bob mode to design production-ready, multi-cloud, event-driven architectures. The agent's role is to work from a written, approved spec and produce architecture deliverables. No implementation code is written in this workspace.

**Workspace layout:**

```
specs/          Spec-driven work: spec.md, plan.md, tasks.md per feature or system
docs/           Architecture outputs produced by the agent (diagrams, decisions, models).
                Shared across specs: every file MUST be prefixed with the spec number, e.g. docs/001-component-matrix.md
.bob/           Bob config: custom mode, rules, MCP example
```

---

## Spec-driven workflow

All architecture work is spec-driven. No architecture deliverable is produced until a spec exists and is approved.

1. **Specify** (`specs/<NNN-name>/spec.md`): business requirements, goals, scope, constraints, risks, and testable acceptance criteria. This is the client's input — the agent does not author the spec without human direction.
2. **Plan** (`specs/<NNN>/plan.md`): architecture approach, cloud selection rationale, integration targets, security posture, open decisions.
3. **Tasks** (`specs/<NNN>/tasks.md`): ordered deliverable checklist — each item one reviewable output (e.g. high-level diagram, component matrix, security design).
4. **Produce**: one deliverable at a time, grounded in the spec.
5. **Verify**: map every spec acceptance criterion to evidence before closing the spec.

The agent reads the active spec before beginning any session. If no spec exists, the agent asks the user to create one before proceeding.

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
| `cloud-architecture-patterns` | `.bob/skills/cloud-architecture-patterns/SKILL.md` | Pattern selection, event-driven design, CQRS, saga, strangler fig, anti-patterns |
| `well-architected-review` | `.bob/skills/well-architected-review/SKILL.md` | Reviewing a completed deliverable against the five-pillar WAF before handoff |

---

## Definition of done

An architecture task is done when:

- [ ] The spec acceptance criteria are mapped to evidence in the deliverable.
- [ ] All three cloud variants are covered with equal depth (or the spec explicitly limits scope to fewer clouds).
- [ ] Every integration target has an explicit auth model and data contract documented.
- [ ] Security design covers IAM, encryption, secrets, and audit logging.
- [ ] A human has reviewed and approved the deliverable before it moves downstream.
- [ ] `<!-- TODO: add your organization's additional DoD items -->`.
