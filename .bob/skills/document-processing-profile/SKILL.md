---
name: document-processing-profile
version: 1.0.1
description: >
  Architecture profile for enterprise document-processing pipelines: ingest, validate, batch,
  LLM summarisation, and lakehouse output (Snowflake, Databricks, Apache Iceberg). Adds
  pattern guidance, schemas, DDL, and review checks specific to this engagement type. Load
  when the spec declares profile: document-processing.
when_to_use: >
  Load when the spec includes profile: document-processing — covering document ingestion
  pipelines, LLM summarisation, reconciliation ledgers, Snowflake or Databricks integration,
  Apache Iceberg lakehouse output, or cross-cloud lakehouse (CCL) connectivity.
---

# Document-Processing Architecture Profile

Load this skill when the spec declares `profile: document-processing`.
All guidance below is **additive** to the base mode rules — it narrows and extends them for
document pipelines. Do not apply these patterns or schemas to engagements that do not involve
document processing.

---

## Hard constraints for this profile

- PII must be sanitized before any document content reaches an LLM API. The architecture must
  show the scan and masking step explicitly, placed before the LLM call boundary.
- Model IDs must never be pinned from memory — model catalogs and deprecation schedules change.
  See "LLM service integration rules" below.

---

## Serverless Batch Aggregator pattern

Collect validated documents into micro-batches before LLM invocation to reduce per-call overhead.

| Cloud | Upload trigger | Queue | Validator | Buffer | Batch orchestrator | LLM target |
|---|---|---|---|---|---|---|
| **AWS** | S3 Event → EventBridge | SQS Standard | Lambda | DynamoDB (doc buffer table) | Step Functions Distributed Map | Bedrock Batch Inference |
| **Azure** | Blob Event → Event Grid | Service Bus Queue | Azure Functions | Cosmos DB / Service Bus Session | Durable Functions / Logic Apps | Azure OpenAI Batch API |
| **GCP** | GCS Notification → Eventarc | Pub/Sub | Cloud Run function | Firestore / Cloud Tasks | Cloud Workflows + Cloud Tasks | Vertex AI Batch Prediction |

**Batching trigger criteria (configure per spec):** time window (e.g. 5 min), document count (e.g. 50 docs), or payload size (e.g. 10 MB) — whichever fires first.

**Overflow protection:** if the document buffer exceeds the maximum batch size before the timer fires, split into multiple batches and enqueue each independently.

---

## Apache Iceberg multi-engine interoperability pattern

Enable Snowflake and Databricks to read and write the same Iceberg tables without data duplication.

### Catalog architecture

| Cloud | Recommended REST Catalog | Notes |
|---|---|---|
| AWS | AWS Glue Iceberg REST endpoint | Native; no additional infra |
| Azure | Apache Polaris (OSS, self-managed or via Databricks Unity Catalog) | Azure has no native Iceberg REST Catalog as of 2025 |
| GCP | Apache Polaris (OSS) or Databricks Unity Catalog | No GCP-native Iceberg REST Catalog |

### Storage credential vending

Direct cloud storage access from Snowflake / Databricks uses short-lived credentials vended by the catalog:

| Cloud | Credential type | Vending mechanism |
|---|---|---|
| AWS | STS AssumeRole temporary credentials | Glue catalog vends via `GetTemporaryGlueTableCredentials` |
| Azure | Azure SAS token (User Delegation SAS, 1 h TTL) | Polaris vends via REST Catalog `loadCredentials` endpoint |
| GCP | GCP short-lived service account token (1 h TTL) | Polaris vends via REST Catalog `loadCredentials` endpoint |

### Schema and partitioning

- Partition by `ingestion_date` (hidden partitioning) and `doc_type`; hidden partitioning avoids partition-column writes in client code.
- Table format: Iceberg v2 (row-level deletes and upserts supported by both Snowflake and Databricks).
- Snowflake access: Iceberg external table via `EXTERNAL VOLUME` + catalog integration.
- Databricks access: Unity Catalog foreign catalog pointing to the same REST Catalog endpoint.

---

## Snowflake and Snowflake Cortex integration pattern

### Path A — In-engine Cortex (preferred for cost when data is already in Snowflake)

```
Processed document text loaded to Snowflake table
  → Snowpark / SQL: SELECT SNOWFLAKE.CORTEX.SUMMARIZE(doc_text) AS summary
  → Summary written to output table in same Snowflake database
```

- No data leaves Snowflake; summary computed in-database.
- Auth: active Snowflake session (key-pair); no additional cloud LLM credentials needed.
- Cost: Cortex credit consumption per token; metered within Snowflake credit allocation.

### Path B — External cloud LLM → Snowpipe Streaming

```
Validated document → Cloud LLM (Bedrock / Azure OpenAI / Vertex AI)
  → Summary payload → Snowpipe Streaming ingest channel
  → Snowflake table (near real-time; latency < 1 min)
```

- Auth: Snowflake key-pair authentication for ingest channel; stored in Secrets Manager.
- Use when: Cortex models are not available in the approved region, or the required model is only on a specific cloud LLM provider.

### Selection criteria

| Criterion | Path A (Cortex) | Path B (External LLM) |
|---|---|---|
| Data already in Snowflake | ✅ Ideal | ⚠️ Redundant transfer |
| Model not available in Cortex | ❌ Blocked | ✅ Use cloud LLM |
| PII in document | ✅ Data stays inside Snowflake perimeter | ⚠️ PII scan mandatory before LLM call |
| Latency requirement < 30 s | ⚠️ Depends on Cortex queue | ✅ Direct API call |

---

## End-to-end reconciliation and audit ledger pattern

### Reconciliation ledger schema

```sql
CREATE TABLE reconciliation_ledger (
  doc_id              VARCHAR(255)  NOT NULL,
  correlation_id      VARCHAR(255)  NOT NULL,
  sha256_checksum     CHAR(64)      NOT NULL,
  raw_storage_uri     VARCHAR(2048) NOT NULL,   -- S3 / Blob / GCS URI (never document content)
  validation_status   VARCHAR(50)   NOT NULL,   -- PENDING | VALID | INVALID | QUARANTINED
  batch_id            VARCHAR(255),
  llm_status          VARCHAR(50),              -- PENDING | PROCESSING | COMPLETE | FAILED
  llm_model_id        VARCHAR(255),
  snowflake_sync_ts   TIMESTAMP,
  databricks_sync_ts  TIMESTAMP,
  iceberg_commit_ts   TIMESTAMP,
  dlq_status          VARCHAR(50),              -- NULL | IN_DLQ | REPLAYED | ABANDONED
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (doc_id)
);

CREATE INDEX idx_recon_batch     ON reconciliation_ledger (batch_id);
CREATE INDEX idx_recon_status    ON reconciliation_ledger (validation_status, llm_status);
CREATE INDEX idx_recon_updated   ON reconciliation_ledger (updated_at);
```

### Reconciliation engine architecture

```
Scheduled trigger (every N minutes, configurable)
  → Reconciliation Worker (serverless: Lambda / Azure Function / Cloud Run job)
      → Query ledger: SELECT docs WHERE (validation_status = 'VALID' AND llm_status IS NULL)
                                      OR (llm_status = 'COMPLETE' AND iceberg_commit_ts IS NULL)
                                      OR (dlq_status = 'IN_DLQ' AND updated_at < NOW() - INTERVAL replay_window)
      → For each discrepancy: publish alert to SNS / Event Grid / Pub/Sub topic
      → For auto-replayable DLQ items: enqueue replay message to input queue
      → Write reconciliation_run_log entry (run_id, start_ts, end_ts, discrepancy_count)
```

**Alert thresholds (configure in spec or open decision):**
- DLQ depth > 10 items → P2 alert
- Reconciliation discrepancy count > 0 → P3 alert within 5 minutes
- Any doc in PENDING > 30 min → P2 alert

---

## LLM service integration rules

**Model selection boundary.** The architect selects the model *class* and the selection criteria, not a pinned model version or tuned parameters. Never pin a model ID from memory — model catalogs and deprecations change faster than this skill. Either (a) cite the provider's current model/lifecycle docs page and the retrieval date, or (b) record the model as an open decision with owner "ML platform team" and list the criteria (task fit, cost per 1K tokens, latency target, region availability, data-residency/provenance, deprecation date). Hyperparameters in a prompt spec are marked `provisional` and are tuned downstream against an evaluation set.

| Field | Content |
|---|---|
| Model identifier | Model class + selection criteria; pinned ID only if the spec supplies one or a current provider doc is cited with date |
| Context window | Max tokens in; document truncation strategy if exceeded |
| Call mode | Synchronous or asynchronous / batch |
| Token budget | Per-invocation limit; per-document cost range with stated assumptions |
| Retry policy | Retry on network/service errors only — **never** on model-level errors (invalid prompt, content policy violation) |
| Prompt storage | Versioned prompt templates stored in `prompts/` in the target project |

### LLM token cost note

Every LLM integration must include an assumption-labelled token cost range:
- Input tokens per document (estimate based on average document size)
- Output tokens per summary
- Cloud LLM cost: price per 1M tokens × estimated volume = monthly cost range
- Snowflake Cortex cost: Snowflake credits per token (reference current Cortex credit table)

State every assumption (volume, document size, unit price with source and date). Give a range,
never a single-point or invoice-grade figure, and label it as an estimate.
When the spec requires a firm dollar figure, record it as an open decision requiring a FinOps review.

---

## Cross-cloud lakehouse (CCL) adapter rules

A dedicated adapter component is required when the spec includes CCL connectivity:

- Retry with exponential backoff on transient failures (max 3 attempts; jitter ± 20%)
- Log every request and response payload hash for audit — never log raw payload content
- Sanitize PII from all log fields before emission
- Independently deployable as its own compute unit (separate function, container, or service)
- Document: catalog technology, access pattern (REST catalog vs. direct storage), credential vending mechanism

---

## Downstream handoff contracts for document-processing

### Ingestion event schema — CloudEvents format

```json
{
  "specversion": "1.0",
  "type": "com.enterprise.doc.ingested",
  "source": "<storage-uri>",
  "id": "<correlation_id>",
  "datacontenttype": "application/json",
  "data": {
    "doc_id": "<uuid>",
    "sha256_checksum": "<hex>",
    "storage_uri": "<s3|blob|gcs uri>",
    "doc_type": "<string>",
    "ingestion_ts": "<ISO-8601>"
  }
}
```

### Processed summary output schema (Iceberg DDL)

```sql
CREATE TABLE processed_summaries (
  doc_id          STRING        NOT NULL,
  batch_id        STRING,
  summary_text    STRING        NOT NULL,
  model_id        STRING        NOT NULL,
  prompt_version  STRING        NOT NULL,
  ingestion_date  DATE          NOT NULL,   -- hidden partition column
  doc_type        STRING        NOT NULL,   -- hidden partition column
  processed_ts    TIMESTAMP     NOT NULL
) USING ICEBERG
PARTITIONED BY (days(ingestion_date), doc_type);
```

### AI prompt specification

Store at `docs/<spec-id>/document_summary_prompt.yaml` (e.g. `docs/001-doc-processing-platform/document_summary_prompt.yaml`):

```yaml
prompt_id: document_summary_v1
model_selection:               # per cloud; see LLM service integration rules above
  status: open_decision | pinned (cite doc URL + date)
  criteria: [task_fit, cost, latency, region, provenance]
  primary: <model id or TBD>
  fallback: <model id or TBD>
hyperparameters:               # provisional, tuned downstream against an eval set
  temperature: <provisional>
  max_output_tokens: <provisional>
prompt_template: |
  Summarize the following document. Focus on key findings and action items.
  Metadata: {{metadata}}
  Document text: {{document_text}}
variable_injection:
  - name: document_text
    source: validated_document_body
    max_chars: 8000
    truncation_strategy: tail
  - name: metadata
    source: reconciliation_ledger
    fields: [doc_id, doc_type, ingestion_ts]
```

---

## Target project folder structure

```
src/
  ingestion/
  validation/
  batching/
  llm_engine/
  adapters/
    snowflake/
    databricks/
    iceberg/
    ccl/
  reconciliation/
terraform/
  aws/
  azure/
  gcp/
tests/
  unit/
  integration/
  failure_scenarios/
prompts/
  document_summary_prompt.yaml
docs/
README.md
```

---

## Well-architected review — additional checks for this profile

When reviewing a document-processing architecture, apply these checks **in addition to** the base
well-architected review questions. A ❌ Fail on any starred (★) check blocks deliverable sign-off.

### Operational Excellence additions

- ★ Are DLQ alert thresholds explicitly defined (depth limit, message age limit)?
- ★ Is dead-letter replay automation documented (trigger mechanism, replay queue, idempotency guarantee)?
- ★ Is a scheduled reconciliation worker specified (trigger interval, discrepancy alert path, run log schema)?

### Security additions

- ★ Is PII sanitization explicitly placed **before** LLM API invocation in the architecture?
- Are CMK KMS keys uniquely specified per micro-component (separate key per service, not one shared key)?

### Reliability additions

- ★ Is jitter explicitly specified for all retry strategies (prevents thundering-herd on recovery)?
- ★ Are batch buffer overflow limits documented (maximum batch size, overflow split strategy)?
- Are circuit breakers documented for all slow/expensive external calls (Snowflake, Databricks, Cloud LLM)?

### Cost Optimization additions

- ★ Is a token cost range present for every LLM integration (input/output tokens, monthly range, assumptions stated)?
- Is storage tiering documented for Iceberg Parquet files and the reconciliation ledger (with lifecycle policy)?

### Common gaps for this profile

- DLQ documented but no alert threshold or automated replay trigger
- Reconciliation worker mentioned but trigger interval and discrepancy SLA not defined
- PII scan step present in diagram but not confirmed to occur before LLM call
- Single KMS key used across all services — per-component CMK not specified
- Retry strategy documented but no jitter — thundering-herd risk on recovery
- Batch buffer overflow behavior not specified — data loss risk on buffer saturation
- Circuit breakers not present on Snowflake/Databricks/LLM calls — slow downstream blocks pipeline
- LLM token cost not estimated — largest variable cost in document processing platforms
- Iceberg / Parquet storage tier not specified — defaults to hot, which is expensive for retained data
- Cross-cloud data transfer (Snowflake ↔ Databricks via object store) not flagged as egress-dominant
