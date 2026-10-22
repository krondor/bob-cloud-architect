# plan.md

**Spec ID:** 002-clinical-trial-telemetry-platform
**Status:** draft
**Created:** 2025-01-27

---

## Architecture approach

The platform is designed around a **high-throughput real-time streaming and event-driven data mesh** with an embedded **clinical AI safety enrichment pipeline**:

1. **Edge Tokenization & Ingestion:** Ingest telemetry and eCRF notes through a regional pseudonymization proxy that strips direct PHI and assigns a deterministic cryptographic `pseudonym_patient_id` before streaming.
2. **Stream Processing & Dual-Path Routing:**
   - **Hot Path (Low Latency $\le 2$s):** Managed stream analytics evaluates sliding-window statistical thresholds (e.g. cardiac arrhythmia, acute hypoxia). Anomalies immediately publish to a high-priority safety alert topic triggering downstream pharmacovigilance (Argus) notifications.
   - **Warm Path (AI Enrichment $\le 60$s):** Anomalies trigger serverless clinical insight synthesis where structured biometrics and clinician notes are passed to a cloud LLM (Bedrock / Azure OpenAI / Vertex AI) using clinical protocol context templates.
   - **Cold Path (Lakehouse $\le 5$m):** Raw telemetry and aggregated windows are persisted as Apache Iceberg Parquet files in object storage, registered in a REST Catalog for simultaneous biostatistics analysis in Snowflake and Databricks.
3. **Reconciliation & Regulatory Audit:** A reconciliation ledger records sequence numbers and cryptographic payload hashes across ingestion, alerting, and lakehouse persistence, providing automated gap detection and 21 CFR Part 11 compliant auditability.

### Primary patterns selected

| Pattern | Rationale |
|---|---|
| Real-time Stream Analytics (Sliding Window) | Detects critical acute biometric threshold breaches in sub-second SLA without database query overhead |
| Hot/Warm/Cold Dual-Path Lambda Architecture | Decouples low-latency safety alerting from heavier LLM enrichment and high-volume lakehouse persistence |
| Tokenization / De-identification Proxy | Guarantees zero raw PHI reaches streaming queues, cloud storage, or LLM inference endpoints |
| Transactional Outbox & Reconciliation Ledger | Enforces auditability and guarantees exactly-once processing semantics across regulatory lakehouses |
| Circuit Breaker & Bulkhead Isolation | Isolates external EDC, Pharmacovigilance, and LLM APIs to prevent downstream backpressure from stalling streaming ingestion |

### Cloud selection rationale

- **AWS:** Amazon Kinesis Data Streams / Managed Service for Apache Flink → Amazon Bedrock (Claude 3.5 Sonnet) → Amazon S3 / Apache Iceberg (AWS Glue / Apache Polaris) → Snowflake / Databricks.
- **Azure:** Azure Event Hubs → Azure Stream Analytics → Azure OpenAI (GPT-4o) → Azure Data Lake Storage Gen2 / Apache Iceberg (Unity Catalog / Microsoft Purview) → Snowflake / Databricks.
- **GCP:** Google Cloud Pub/Sub → Google Cloud Dataflow (Apache Beam) → Vertex AI (Gemini 1.5 Pro) → Google Cloud Storage / Apache Iceberg (BigQuery Metastore / Apache Polaris) → Snowflake / Databricks.

### Security posture

- **Compliance:** 21 CFR Part 11, GxP, HIPAA, and GDPR compliant baseline.
- **Encryption:** KMS Customer-Managed Keys (CMK) for streaming queues, compute state stores, and object storage with mandatory envelope encryption.
- **Identity & Access:** Granular IAM roles / Azure Managed Identities / GCP Service Accounts per compute stage (zero shared roles; least-privilege).
- **Audit Logs:** Immutable WORM object lock enabled on all audit log buckets (25-year retention).

---

## Open decisions to resolve before architecture review

See `spec.md` open decisions #1 through #6 (EDC webhook signing, Argus FHIR schema, Snowflake Iceberg storage integration, Unity Catalog multi-cloud federation, and LLM token budget).
