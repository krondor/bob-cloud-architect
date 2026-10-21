# plan.md

**Spec ID:** 001-doc-processing-platform
**Status:** draft
**Created:** 2025-01-27

---

## Architecture approach

The platform is built on an **event-driven orchestration** model. Storage upload events trigger a
validation pipeline; validated documents are buffered and batch-aggregated before LLM invocation
to minimize per-token costs and maximize throughput. Summaries are written to an Apache Iceberg
lakehouse accessible simultaneously by Snowflake and Databricks. A dedicated reconciliation engine
provides an end-to-end audit ledger and automated discrepancy alerting.

### Primary patterns selected

| Pattern | Rationale |
|---|---|
| Event orchestration (Saga) | Multi-step pipeline with compensation logic on validation failure; clear audit trail of each document's progress |
| Serverless Batch Aggregator | Collect validated documents into micro-batches before LLM invocation to reduce per-call overhead |
| Transactional outbox (Reconciliation ledger) | Every state transition written atomically to the reconciliation ledger before the next stage fires |
| Circuit breaker | Wraps Snowflake, Databricks, and Cloud LLM calls to prevent cascade failures from slow dependencies |
| Bulkhead | Separate queues and compute pools for ingestion, validation, batching, LLM, and reconciliation |

### Cloud selection rationale

No single cloud is preferred. Each cloud receives an identical architecture using cloud-native
services. Cross-cloud portability is achieved through:

1. Cloud-agnostic interfaces: Apache Iceberg REST Catalog API is cloud-portable
2. Open formats: Parquet / Iceberg on object storage enables multi-engine reads
3. Identical patterns: the same event-driven pipeline topology maps to native services on each cloud

### Integration approach

- **Snowflake:** Key-pair auth via Secrets Manager; Snowpipe Streaming for low-latency loads; Cortex for in-database LLM
- **Databricks:** Service principal via Secrets Manager; Delta Sharing or REST API write; Unity Catalog metadata
- **Apache Iceberg:** REST Catalog selected per cloud (Glue / Polaris / Unity); storage credential vending (STS/GCP short-lived tokens/Azure SAS) for direct read/write
- **CCL systems:** Dedicated adapter with retry/backoff, payload hash logging, PII sanitization

### Security posture

- CMK encryption on all data at rest; TLS 1.3 in transit
- One IAM role/service account per compute component; no shared roles
- PII scanning at validation stage before any LLM invocation
- All secrets in cloud-native secrets store; 90-day rotation
- 7-year immutable audit log retention

---

## Open decisions to resolve before architecture review

See `spec.md` open decisions #2, #4, and #6 (Cortex model availability, Iceberg catalog selection,
token budget). These affect component selection but do not block the architecture outline.
