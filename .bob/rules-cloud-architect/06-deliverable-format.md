<!-- always active -->

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

11. Target Project Folder Structure
    - Top-level layout matching the architecture components
    - One entry per deployable unit or major module
    - Adapt to the spec's technology choices; do not impose a fixed folder tree

12. Implementation Plan
    - Ordered phases with dependencies
    - Hand-off criteria to downstream modes (agent mode for code, IaC mode for Terraform)

13. Open Decisions
    - Unresolved items requiring human input before implementation
    - Owner and target resolution date
```

## Diagram conventions

- `subgraph` for system boundaries (cloud region, enterprise network, external system)
- Label every arrow with data type or event name
- Failure paths: dashed arrows `-.->` 
- Consistent node naming: `ServiceName["ServiceName\n(AWS/Azure/GCP)"]`

## Tables

Prefer tables over bullet lists for comparisons, matrices, and multi-attribute descriptions.
Prose for explanations. Code blocks for schemas, configs, and directory trees.

## Output location

`docs/` and `prompts/` are shared across all specs, so every file written to either directory MUST be prefixed with the spec number (`<NNN>`, the leading digits of the spec folder, e.g. `001`) to prevent one spec's deliverables overwriting another's. Never write an unprefixed file into `docs/` or `prompts/`. This applies to the file name only.

- Architecture documents: `docs/<NNN>-<artifact-name>.md` (e.g. `docs/001-architecture-overview.md`)
- Component selection matrix: `docs/<NNN>-component-matrix.md` (canonical hand-off artifact for downstream modes)
- If a task or acceptance criterion lists an unprefixed `docs/` or `prompts/` path, apply the `<NNN>-` prefix anyway and flag it for correction.
- Before writing a deliverable, check that the target path does not already exist for a different spec; never overwrite another spec's file.
