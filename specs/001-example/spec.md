# spec.md

**Spec ID:** 001-example
**Mode:** cloud-architect
**Status:** archived
**Created:** 2025-01-27
**Author:** example

---

## Business problem

A global pharmaceutical company processes millions of regulatory submission documents per year
across three lines of business. Documents arrive from external partners via SFTP and internal
systems via REST API. Each document must be validated against a schema, scanned for PII, enriched
with metadata from a master data service, and loaded into a centralized data warehouse for
regulatory reporting. Processing must be traceable end-to-end and auditable for compliance.

Currently this is handled by a legacy batch job that runs nightly, produces no per-document status
tracking, and has no retry or dead-letter handling. The business needs near-real-time processing
(documents available for reporting within 15 minutes of receipt), full per-document audit trail,
and a path to integrate an LLM-based document classifier in a future phase.

---

## Scope

**In scope:**
- High-level cloud-agnostic architecture diagram
- Cloud-specific architecture diagrams for AWS, Azure, and GCP
- Component selection matrix
- Integration architecture for the three integration targets below
- Failure handling design (retry, DLQ, dead-letter reprocessing)
- Security design (IAM, encryption, secrets, audit logging, PII handling)
- Data model (document status state machine, status tracking schema)
- Implementation plan

**Out of scope:**
- Implementation code, Terraform, or test plans
- SFTP server infrastructure (provided by the partner network team)
- LLM classifier integration (deferred to a future spec)
- Cost estimation (out of scope for this phase; add as a future spec task if required)

---

## Target clouds

All three: AWS, Azure, and GCP. The company operates different lines of business on different
clouds. The architecture must be deployable on any of the three without re-design.

---

## Integration targets

| System | Direction | Known connection details | Unknowns |
|---|---|---|---|
| **Master data service** | Inbound (read) | REST API; OpenAPI spec available; basic auth today | Plans to move to OAuth 2.0 client credentials — timeline unknown |
| **Data warehouse** (Snowflake) | Outbound (write) | Snowflake JDBC or Snowflake Connector for Python; key-pair auth | Target schema not finalized; open decision #2 |
| **Regulatory reporting portal** | Outbound (event) | Webhook; HTTPS POST; portal team owns the endpoint | Payload schema not published; open decision #3 |

---

## Constraints

- Approved cloud regions: AWS us-east-1, Azure eastus, GCP us-central1 (data residency: US only)
- PII scanning must occur before any data leaves the ingestion boundary
- Audit logs must be immutable and retained for 7 years (regulatory requirement)
- TLS 1.2 minimum for all connections; TLS 1.3 preferred
- No static long-lived credentials for compute — identity federation or managed identity required
- Document content must never appear in logs (only document ID, stage, outcome, error code)

---

## Acceptance criteria

The architecture deliverable is complete when all of the following are satisfied:

- [ ] High-level cloud-agnostic architecture diagram present and covers the full document lifecycle
- [ ] Cloud-specific diagrams present for AWS, Azure, and GCP with named services
- [ ] Component selection matrix covers: ingestion, event notification, queue, compute, storage, secrets, KMS, monitoring, and DLQ
- [ ] All three integration targets documented with connection mechanism, auth model, data flow direction, failure behavior, and observability
- [ ] Failure handling design covers retry strategy, DLQ routing, and dead-letter reprocessing trigger
- [ ] Security design covers IAM/RBAC (one role per component), encryption at rest and in transit, secrets management, audit logging, and PII handling policy
- [ ] Document status state machine diagram present
- [ ] Open decisions list populated with owner and target date fields
- [ ] Implementation plan with ordered phases and hand-off criteria

---

## Open decisions

| # | Decision | Owner | Target date |
|---|---|---|---|
| 1 | Master data service OAuth 2.0 migration timeline — affects auth model in integration design | Partner integration team | Before architecture review |
| 2 | Snowflake target schema — affects output data model and loader design | Data warehouse team | Before implementation phase 2 |
| 3 | Regulatory portal webhook payload schema — affects event contract and retry design | Portal team | Before implementation phase 3 |
