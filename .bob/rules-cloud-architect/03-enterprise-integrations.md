<!-- always active -->

# Enterprise Integration Architecture

Every integration target in the selected spec must be documented with the six required fields below.
Do not assume any particular set of targets — the list is defined by the spec.

## Required fields per integration

| Field | Content |
|---|---|
| Connection mechanism | SDK, REST API, connector, JDBC, or streaming |
| Auth model | Credential type, rotation policy, secret store reference |
| Data flow direction | Inbound, outbound, or bidirectional |
| Failure behavior | On connectivity loss, auth failure, schema mismatch |
| Observability | Metrics, traces, logs emitted by this integration |
| Data governance | PII classification, encryption in transit, access control |

Present each integration as a named subsection: table of 6 fields + brief prose on the connection pattern.

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

For every LLM service documented:

**Model selection boundary.** The architect selects the model *class* and the selection criteria, not a pinned model version or tuned parameters. Never pin a model ID from memory — model catalogs and deprecations change faster than this rule file. Either (a) cite the provider's current model/lifecycle docs page and the retrieval date, or (b) record the model as an open decision with owner "ML platform team" and list the criteria (task fit, cost per 1K tokens, latency target, region availability, data-residency/provenance, deprecation date). Hyperparameters in a prompt spec are marked `provisional` and are tuned downstream against an evaluation set.

| Field | Content |
|---|---|
| Model identifier | Model class + selection criteria; pinned ID only if the spec supplies one or a current provider doc is cited with date |
| Context window | Max tokens in; document truncation strategy if exceeded |
| Call mode | Synchronous or asynchronous / batch |
| Token budget | Per-invocation limit; per-document cost range with stated assumptions |
| Retry policy | Retry on network/service errors only — **never** on model-level errors (invalid prompt, content policy violation) |
| Prompt storage | Versioned prompt templates stored in `prompts/` in the target project |

---

## Cross-cloud lakehouse (CCL) adapter rules

A dedicated adapter component is required when the spec includes CCL connectivity:

- Retry with exponential backoff on transient failures (max 3 attempts; jitter ± 20%)
- Log every request and response payload hash for audit — never log raw payload content
- Sanitize PII from all log fields before emission
- Independently deployable as its own compute unit (separate function, container, or service)
- Document: catalog technology, access pattern (REST catalog vs. direct storage), credential vending mechanism
