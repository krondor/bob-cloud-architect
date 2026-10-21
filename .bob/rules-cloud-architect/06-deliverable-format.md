<!-- load when: assembling a final architecture deliverable, writing plan.md or the complete architecture document, or checking deliverable completeness -->

# Deliverable Format

Every architecture deliverable follows this structure. Missing sections are explicitly noted as out-of-scope with a rationale, not silently omitted.

## Required sections per architecture document

```
1. Overview
   - Business problem being solved (one paragraph, sourced from spec)
   - Scope: which clouds, which integrations, which phases

2. High-Level Architecture
   - Cloud-agnostic component diagram (Mermaid flowchart)
   - Processing sequence (Mermaid sequenceDiagram)

3. Cloud-Specific Architecture
   - AWS variant (Mermaid flowchart with AWS service names)
   - Azure variant (Mermaid flowchart with Azure service names)
   - GCP variant (Mermaid flowchart with GCP service names)

4. Component Selection Matrix
   - Table: Capability | AWS service | Azure service | GCP service | Rationale

5. Enterprise Integration Architecture
   - One subsection per integration target listed in the spec
   - Each: connection mechanism, auth model, data flow, failure behavior, observability

6. Failure Handling Design
   - Retry strategy (max attempts, backoff algorithm, jitter)
   - DLQ design (routing, alerting, reprocessing trigger)
   - Recovery runbook pointer (reference, not full content)

7. High Availability and Disaster Recovery
   - RPO and RTO targets (state as open decisions if not provided in spec)
   - HA pattern selection with rationale (active-active / active-passive / pilot-light / backup-restore)
   - Multi-region topology diagram (Mermaid flowchart)
   - Data residency mapping (if residency constraints are stated in spec)
   - Failover runbook pointer (reference, not full content)
   Note: omit with rationale only if the spec explicitly excludes HA/DR from scope.

8. Security Design
   - IAM/RBAC matrix
   - Encryption table
   - Secrets management plan
   - Audit logging design
   - Data governance notes

9. Data Model
   - Status state machine (Mermaid stateDiagram-v2)
   - Status tracking table schema
   - Output schemas for integration targets defined in spec

10. Folder Structure
    - Canonical project directory layout (code block)

11. Implementation Plan
    - Ordered phases with dependencies
    - Hand-off criteria to downstream modes

12. Open Decisions
    - Unresolved items requiring human input before implementation
    - Owner and target resolution date (populated by human reviewer)
```

## Diagram conventions

- Use `subgraph` to separate system boundaries (cloud region, enterprise network, external systems).
- Label every arrow with the data type or event name being passed.
- Use consistent node naming: `ServiceName[ServiceName\nCloud: AWS/Azure/GCP]`.
- Failure paths use dashed arrows: `-.->`.

## Tables

Prefer tables over bullet lists for comparisons, matrices, and multi-attribute descriptions. Prose for explanations. Code blocks for all schemas, configs, and directory trees.

## Output location

Architecture documents are saved to `docs/<spec-id>-<artifact-name>.md`. The component selection matrix is always saved to `docs/component-matrix.md` (overwritten on update) as it is the canonical hand-off artifact for downstream modes.
