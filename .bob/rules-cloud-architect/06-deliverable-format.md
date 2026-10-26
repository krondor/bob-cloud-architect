# Deliverable Format

The sections below describe the **completed architecture package**, not each artifact. A single
artifact (one `tasks.md` item) covers only the sections its task names. Before closing the spec,
every section is either present somewhere in the package or noted as out-of-scope with a rationale
— never silently omitted.

## Required sections

```
1. Overview
   - Business problem (one paragraph, sourced from spec)
   - Scope: clouds, integrations, phases

2. High-Level Architecture
   - Cloud-agnostic component diagram (Mermaid flowchart, L1 + L2)
   - Processing sequence (Mermaid sequenceDiagram) — when the spec involves a non-trivial flow

3. Cloud-Specific Architecture
   - One Mermaid flowchart per target cloud named in the spec, with cloud service names
   - Omit clouds not in scope; note which clouds are excluded and why

4. Component Selection Matrix
   Table: Capability | <Cloud A> | <Cloud B> | <Cloud C> | Rationale | Cost Model
   *** Cost Model column is MANDATORY — never omit ***
   Include only the clouds named in the spec.

5. Enterprise Integration Architecture
   - One subsection per integration target in the spec
   - Each: connection mechanism, auth model, data flow, failure behavior, observability, data governance

6. Failure Handling Design
   - Retry strategy: max attempts, backoff algorithm (exponential + jitter), jitter range
   - Dead-letter design: routing, alert threshold (depth and age), reprocessing trigger
   - Recovery runbook pointer

7. High Availability and Disaster Recovery
   - RPO/RTO targets (open decisions if not in spec)
   - HA pattern with rationale
   - Multi-region topology diagram (Mermaid) — when multi-region is in scope
   - Data residency mapping
   - Failover runbook pointer
   Omit only if spec explicitly excludes HA/DR; state rationale.

8. Security Design
   - IAM/RBAC matrix (one role per component — never shared roles)
   - Encryption table (at rest: KMS CMK; in transit: TLS 1.3)
   - Secrets management plan (naming convention, rotation interval, rotation mechanism)
   - Audit logging design (log fields, retention policy, immutability)
   - Data governance: classification, residency, and any handling constraints stated in the spec

9. Data Model
   - State machine for any entity that has a lifecycle (Mermaid stateDiagram-v2)
   - Schema or DDL for any persistent store introduced by the architecture
   - Output schemas for integration targets (format defined by spec: JSON Schema, Avro, Parquet, etc.)

10. Downstream Handoff Contracts
    - Event or message schema for every async boundary (format: CloudEvents, Avro, JSON Schema, etc.)
    - API contract summary for every synchronous boundary
    - Data contract for every integration target (fields, types, versioning strategy)

11. Target Project Folder Structure — only when the spec's scope lists it
    - Top-level layout matching the architecture components, one entry per deployable unit
    - Adapt to the spec's technology choices; do not impose a fixed folder tree

12. Implementation Plan
    - Ordered phases with dependencies
    - Hand-off criteria to downstream modes (agent mode for code, IaC mode for Terraform)

13. Open Decisions
    - Unresolved items requiring human input before implementation
    - Owner and target resolution date
```

## Diagram conventions

See `04-architecture-standards.md` (C4 levels and diagram conventions).

## Tables

Prefer tables over bullet lists for comparisons, matrices, and multi-attribute descriptions.
Prose for explanations. Code blocks for schemas, configs, and directory trees.

## Output location

Each spec writes only inside its own folder, `docs/<spec-id>/`, where `<spec-id>` is the spec's
folder name under `specs/` (e.g. `docs/001-doc-processing-platform/`). Never write a file directly
into `docs/` or into another spec's folder.

- Architecture documents: `docs/<spec-id>/<artifact-name>.md` (e.g. `docs/001-doc-processing-platform/architecture-overview.md`)
- Component selection matrix: `docs/<spec-id>/component-matrix.md` (canonical hand-off artifact for downstream modes)
- Evidence register: `docs/<spec-id>/evidence-register.md` (see below)
- If a task or acceptance criterion lists a path outside `docs/<spec-id>/`, write to `docs/<spec-id>/` anyway and flag the task for correction.

## Evidence register

Keep one compact table per spec at `docs/<spec-id>/evidence-register.md`. Add a row when a
decision depends on a fact about a service, quota, price, region, or compliance rule. Verify
decision-critical facts once, then reuse the row instead of re-checking.

| Claim | Applies to | Source and date | Status | Decisions that depend on it |
|---|---|---|---|---|
| <!-- e.g. Service X is GA in region Y --> | <!-- cloud/service --> | <!-- doc URL, YYYY-MM-DD --> | verified / unverified / stale | <!-- ADR or section --> |

`verified` requires a vendor documentation URL opened in this session (doc tool or fetch) and its
date. Skill text, memory, and "standard documentation" are not sources: record those claims as
`unverified` and say so in the summary, even when the user asked for verification.
