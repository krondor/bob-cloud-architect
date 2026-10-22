# tasks.md

**Spec ID:** <!-- e.g. 001-event-platform-arch -->
**Status:** draft
**Created:** <!-- YYYY-MM-DD -->

---

## Tasks

Produce deliverables one at a time in the order below. Each item corresponds to one reviewable output.

- [ ] **Task 1: High-level cloud-agnostic architecture diagram**
  - Scope: Complete event flow, components, data flow, failure boundaries.
  - Deliverable: Mermaid diagram in `docs/NNN-architecture-overview.md`.

- [ ] **Task 2: Cloud-specific architecture diagrams (AWS, Azure, GCP)**
  - Scope: 1:1 service mappings with equal depth across AWS, Azure, and GCP.
  - Deliverable: Cloud diagrams in `docs/NNN-cloud-architectures.md`.

- [ ] **Task 3: Component selection matrix**
  - Scope: Tabular comparison covering all capabilities, trade-offs, and cost model.
  - Deliverable: Component matrix in `docs/NNN-component-matrix.md`.

- [ ] **Task 4: Enterprise integration architecture**
  - Scope: Auth, protocol, and failure handling for all external integration targets.
  - Deliverable: Integration specs in `docs/NNN-enterprise-integrations.md`.

- [ ] **Task 5: Failure handling and resilience design**
  - Scope: Retry policies, DLQ replay, batch aggregation overflow, reconciliation ledger.
  - Deliverable: Failure handling design in `docs/NNN-resilience-design.md`.

- [ ] **Task 6: Security and compliance design**
  - Scope: Per-component IAM/RBAC, KMS CMK, secrets rotation, PII handling, audit log retention.
  - Deliverable: Security architecture in `docs/NNN-security-design.md`.

- [ ] **Task 7: Data models and contracts**
  - Scope: CloudEvents JSON Schema, status tracking / reconciliation ledger DDL, prompt specifications.
  - Deliverable: Schemas and DDL in `docs/NNN-data-contracts.md`; prompt specification in `prompts/NNN-<prompt-name>.yaml` (e.g. `prompts/NNN-document_summary_prompt.yaml`).

- [ ] **Task 8: Recommended folder structure**
  - Scope: Target directory layout for downstream code and IaC generation.
  - Deliverable: Folder layout in `docs/NNN-folder-structure.md`.

- [ ] **Task 9: Implementation plan**
  - Scope: Phased rollout, dependencies, risks, milestones.
  - Deliverable: Implementation plan in `docs/NNN-implementation-plan.md`.
