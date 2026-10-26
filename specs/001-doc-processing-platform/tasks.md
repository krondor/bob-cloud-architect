# tasks.md

**Spec ID:** 001-doc-processing-platform
**Status:** in-progress

---

## Deliverable checklist

Tasks must be executed in order. Each is one reviewable output. Mark `[x]` on human approval.

- [ ] **T1 — High-level cloud-agnostic architecture diagram**
  - L1 context + L2 container diagrams (Mermaid)
  - Full document lifecycle: ingest → validate → batch → LLM → lakehouse → reconcile
  - Acceptance: all spec acceptance criteria rows 1–2 satisfied

- [ ] **T2 — Cloud-specific architecture diagrams**
  - AWS, Azure, and GCP variants with named services at L2
  - Acceptance: spec rows 1–2 satisfied for all three clouds

- [ ] **T3 — Component selection matrix**
  - Capability | AWS | Azure | GCP | Rationale | Cost Model
  - Must include: ingestion, event notification, queue, serverless compute, LLM service, batch orchestrator, document buffer, Iceberg catalog, secrets, KMS, monitoring, DLQ
  - Acceptance: spec row 3 satisfied

- [ ] **T4 — Serverless Batch Aggregator pattern**
  - Reference architectures for AWS (SQS/Step Functions/Bedrock), Azure (Service Bus/Event Hubs/Azure OpenAI), GCP (Pub/Sub/Cloud Tasks/Vertex AI)
  - Acceptance: spec row 4 satisfied

- [ ] **T5 — Apache Iceberg interoperability architecture**
  - REST Catalog selection per cloud; storage credential vending model; Snowflake + Databricks simultaneous access
  - Acceptance: spec row 5 satisfied

- [ ] **T6 — Snowflake and Snowflake Cortex integration**
  - Path A (in-engine Cortex) and Path B (external LLM → Snowpipe Streaming); auth model
  - Acceptance: spec row 6 satisfied

- [ ] **T7 — Enterprise integration architecture**
  - All 6 integration targets: connection mechanism, auth model, data flow, failure behavior, observability
  - Acceptance: spec row 7 satisfied

- [ ] **T8 — Reconciliation ledger and engine**
  - Immutable audit ledger schema (all required fields); reconciliation worker architecture; discrepancy alerting
  - Acceptance: spec rows 8–9 satisfied

- [ ] **T9 — Security design**
  - IAM/RBAC matrix, KMS CMK encryption table, PII sanitization point, secrets naming convention, audit log retention
  - Acceptance: spec row 10 satisfied

- [ ] **T10 — Failure handling design**
  - Retry strategy (attempts, backoff, jitter), DLQ routing + alerting threshold, automated replay trigger
  - Acceptance: spec row 11 satisfied

- [ ] **T11 — Downstream handoff contracts**
  - CloudEvents ingestion event JSON Schema
  - Status & reconciliation ledger DDL
  - Processed summary output Parquet/Iceberg DDL
  - AI prompt specification (`docs/001-doc-processing-platform/document_summary_prompt.yaml` with variable injection, hyperparameters, fallback hierarchy)
  - Canonical project folder tree
  - Acceptance: spec rows 12–16 satisfied

- [ ] **T12 — Implementation plan**
  - Ordered phases with dependencies and hand-off criteria to downstream modes
  - Acceptance: spec row 17 satisfied

- [ ] **T13 — Well-Architected Review**
  - Run `well-architected-review` skill against the completed deliverable
  - Resolve all ❌ Fail pillars; log ⚠️ Gap items as open decisions
  - Acceptance: Security and Reliability pillars pass; all gaps documented
