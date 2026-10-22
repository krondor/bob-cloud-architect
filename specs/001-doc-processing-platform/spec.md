# spec.md

**Spec ID:** 001-doc-processing-platform
**Mode:** cloud-architect
**Status:** active
**Created:** 2025-01-27
**Author:** enterprise-poc-team

---

## Business problem

A global enterprise must process high volumes of regulatory and business documents in near real
time across AWS, Azure, and GCP. Documents arrive via object storage upload events. Each document
must be validated, batch-aggregated for cost-efficient LLM processing, summarized by an AI engine
(cloud LLMs and/or Snowflake Cortex), and loaded into a multi-engine lakehouse (Snowflake +
Databricks over Apache Iceberg). The platform must be fully auditable, resilient to partial
failures, and support cross-cloud data access from CCL systems without data duplication.

---

## Scope

**In scope:**
- Multi-cloud event-driven architecture: AWS, Azure, and GCP with 100% feature parity
- Storage event triggers → Messaging Queue → Serverless Validator
- Serverless Batch Aggregator grouping validated documents for LLM processing
- LLM Summarization Engine: Cloud-native LLMs (Bedrock, Azure OpenAI, Vertex AI) + Snowflake Cortex
- Lakehouse integration: Snowflake, Databricks, Apache Iceberg (REST Catalog + storage credential vending)
- CCL system adapter (cross-cloud lakehouse read/write)
- Resilience: exponential backoff retries, DLQ with automated replay, reconciliation ledger
- Security design: IAM/RBAC (per-component), KMS CMK encryption, Secrets Manager, PII sanitization pre-LLM
- Cost model across all components (storage tiers, serverless invocations, token costs, egress)
- Downstream handoff contracts: CloudEvents JSON Schema, DDL for status/reconciliation ledger, prompt spec, canonical folder tree

**Out of scope:**
- Implementation code in any language
- Terraform / IaC definitions
- Test plans or CI/CD pipeline definitions
- SFTP ingestion path (handled by partner network team)

---

## Target clouds

AWS, Azure, and GCP — all three with equal depth. The enterprise runs different lines of business
on each cloud; the architecture must be deployable on any of the three without re-design.

---

## Integration targets

| System | Direction | Connection | Auth model | Unknowns |
|---|---|---|---|---|
| **Snowflake** | Outbound (write + query) | Snowflake Connector / Snowflake Streaming | Key-pair auth via Secrets Manager | Target schema finalization — open decision #1 |
| **Snowflake Cortex** | Outbound (LLM invocation) | Snowflake SQL / Snowpark `SNOWFLAKE.CORTEX.SUMMARIZE` | Snowflake session (key-pair) | Model availability by region — open decision #2 |
| **Databricks** | Outbound (write + query) | Databricks REST API / Delta Sharing | Service principal via Secrets Manager | Unity Catalog workspace URL — open decision #3 |
| **Apache Iceberg** | Bidirectional | REST Catalog API (Polaris / Glue / Unity) + direct storage (credential vending) | STS / short-lived tokens / Azure SAS | Catalog selection per cloud — open decision #4 |
| **CCL systems** | Inbound (read) | REST API; TLS; structured payload | API key via Secrets Manager | Payload schema versioning — open decision #5 |
| **Cloud LLMs** | Outbound (LLM invocation) | Cloud-native SDK (Bedrock, Azure OpenAI, Vertex AI) | IAM role / Managed Identity / Service Account | Token budget per document — open decision #6 |

---

## Constraints

- Approved regions: AWS us-east-1, Azure eastus, GCP us-central1 (data residency: US only)
- PII scanning must occur **before** any document content reaches the LLM API
- Audit logs must be immutable and retained for 7 years (regulatory requirement)
- TLS 1.2 minimum; TLS 1.3 preferred on all connections
- No static long-lived credentials — identity federation or managed identity for all compute
- Document content must never appear in logs (only doc_id, stage, outcome, error code)
- KMS Customer-Managed Keys (CMK) required for all data at rest
- Snowflake key-pair authentication; no username/password credentials

---

## Acceptance criteria

The architecture deliverable is complete when all of the following are satisfied:

- [ ] Cloud-agnostic component diagram covers the full document lifecycle end-to-end
- [ ] Cloud-specific diagrams (AWS, Azure, GCP) present with named services at L1 and L2
- [ ] Component selection matrix includes: ingestion, event notification, queue, serverless compute, LLM service, batch orchestrator, document buffer, Iceberg catalog, secrets, KMS, monitoring, DLQ — with a **Cost Model** column per row
- [ ] Serverless Batch Aggregator pattern documented for all three clouds
- [ ] Apache Iceberg interoperability pattern documented: REST Catalog selection per cloud, storage credential vending, simultaneous Snowflake + Databricks read/write
- [ ] Snowflake Cortex integration documented: Path A (in-engine Cortex) and Path B (external cloud LLM → Snowpipe Streaming)
- [ ] All six integration targets documented with connection mechanism, auth model, data flow, failure behavior, observability
- [ ] Reconciliation ledger schema documented with all required fields
- [ ] Reconciliation engine architecture documented (scheduled worker, discrepancy alerting)
- [ ] Security design: IAM/RBAC matrix (one role per component), KMS CMK encryption table, PII sanitization point, secrets naming convention, audit log retention plan
- [ ] Failure handling: retry strategy (max attempts, backoff, jitter), DLQ routing + alerting threshold, automated replay trigger
- [ ] CloudEvents ingestion event JSON Schema present in deliverable
- [ ] Status & reconciliation ledger DDL present in deliverable
- [ ] Processed summary output schema (Parquet/Iceberg DDL) present in deliverable
- [ ] AI prompt specification present (`prompts/document_summary_prompt.yaml` format with variable injection points and hyperparameters)
- [ ] Canonical project folder tree present in deliverable
- [ ] Implementation plan with ordered phases and hand-off criteria to downstream modes

---

## Open decisions

| # | Decision | Owner | Target date |
|---|---|---|---|
| 1 | Snowflake target schema finalization — affects loader and reconciliation ledger design | Data platform team | Before implementation phase 2 |
| 2 | Snowflake Cortex model availability in approved region (us-central1 / us-east-1) | ML platform team | Before architecture review |
| 3 | Databricks Unity Catalog workspace URL and workspace-level permissions model | Data engineering team | Before implementation phase 2 |
| 4 | Iceberg REST Catalog selection per cloud: AWS Glue vs. Polaris vs. Unity Catalog | Architecture review board | Before architecture review |
| 5 | CCL system payload schema versioning strategy | CCL integration team | Before implementation phase 3 |
| 6 | LLM token budget per document and fallback model hierarchy | ML platform team | Before architecture review |
