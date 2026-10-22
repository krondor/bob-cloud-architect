---
name: cloud-architecture-patterns
version: 1.1.0
description: >
  Pattern catalog for enterprise cloud architecture. Covers event-driven, data, structural,
  and integration patterns with cloud-native service mappings for AWS, Azure, and GCP.
  Includes decision trees, anti-patterns, and failure modes.
when_to_use: >
  Load when selecting an architecture pattern for a new system, when the spec describes
  event-driven, streaming, or data pipeline requirements, or when the agent needs to
  reason about pattern trade-offs and failure modes before producing a deliverable.
---

# Cloud Architecture Patterns

## How to use this skill

1. Read the spec to identify the system's primary characteristics: data volume, latency
   requirements, consistency needs, team topology, and cross-service transaction requirements.
2. Use the **pattern decision tree** to narrow to 1–3 candidate patterns.
3. Read the candidate pattern entries for intent, when to use, failure modes, and cloud mapping.
4. Document the chosen pattern and the rationale for rejecting alternatives in the deliverable's
   Open Decisions section as an ADR.

---

## Pattern decision tree

```
Is the system processing discrete events or documents one at a time?
├── Yes → Is strict ordering required across all events?
│         ├── Yes  → Event Orchestration (Saga) + FIFO queue
│         └── No   → Event Choreography or Transactional Outbox (if DB consistency needed)
└── No  → Is the system aggregating documents for batch LLM processing?
          ├── Yes → Serverless Batch Aggregator
          └── No  → Is the system reading and writing the same data model at different rates?
                    ├── Yes → CQRS (with or without Event Sourcing)
                    └── No  → Is the system replacing a legacy monolith incrementally?
                              ├── Yes → Strangler Fig
                              └── No  → Data Mesh (if cross-domain data sharing) or Lambda/Kappa (if streaming analytics)
```

---

## Event-driven patterns

### Event choreography

**Intent:** Services publish events to a shared bus. Other services subscribe and react
independently. No central coordinator.

**Use when:**
- Loose coupling is the primary goal
- Teams own separate services with separate deployment lifecycles
- Eventual consistency is acceptable

**Do NOT use when:**
- You need compensating transactions (rollback across services on failure)
- You need a clear audit trail of which step processed a given event
- The flow has more than 4–5 steps — choreography becomes an implicit state machine
  that is impossible to reason about

**Failure modes to design for:**
- Duplicate event delivery (idempotent consumers are mandatory)
- Out-of-order event arrival (use sequence numbers or timestamps in the event schema)
- Silent consumer failures (dead-letter queue + alerting on DLQ depth)
- Event schema drift (versioned event schemas, schema registry)

**Cloud-native service mapping:**

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Event bus | EventBridge | Event Grid | Eventarc |
| Message queue | SQS (Standard) | Service Bus Queue | Pub/Sub |
| Dead-letter | SQS DLQ | Service Bus DLQ | Pub/Sub dead-letter topic |
| Schema registry | Glue Schema Registry | Schema Registry (Event Hubs) | Pub/Sub Schema |

---

### Event orchestration — Saga pattern

**Intent:** A coordinator (orchestrator) directs each step in a multi-service transaction.
On failure, the orchestrator issues compensating transactions to undo completed steps.

**Variants:**
- **Choreography-based saga:** each service publishes a success/failure event; next step reacts.
  Lower operational overhead; harder to visualize.
- **Orchestration-based saga:** a central orchestrator calls each step and handles compensation.
  Higher visibility; single point of complexity.

**Use when:**
- Cross-service transactions require rollback on partial failure
- You need a single view of a transaction's progress and state
- The flow has 4+ steps with complex compensation logic

**Do NOT use when:**
- Services are owned by the same team and a shared DB transaction would suffice
- The domain has no compensating actions (financial debits, sent emails — prefer idempotency)

**Failure modes to design for:**
- Orchestrator failure mid-saga (persist saga state before each step; replay from last checkpoint)
- Compensating transaction failure (compensations must also be idempotent and retriable)
- Timeout between steps (set explicit step timeouts; treat timeout as failure)

**Cloud-native service mapping:**

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Orchestrator | Step Functions (Standard workflow — use Standard, not Express; sagas require long-running, exactly-once execution) | Durable Functions / Logic Apps | Workflows |
| State persistence | Step Functions built-in | Durable Functions storage | Workflows built-in |
| Async step trigger | SQS + Lambda | Service Bus + Functions | Pub/Sub + Cloud Functions |

---

### Transactional outbox

**Intent:** Write to a local outbox table in the same DB transaction as the business write.
A relay process reads the outbox and publishes events. Guarantees at-least-once event delivery
without distributed transactions.

**Use when:**
- You need guaranteed event publication when a DB write succeeds
- Two-phase commit across DB and message broker is not acceptable
- The source database supports CDC (change-data-capture) or outbox polling

**Do NOT use when:**
- Your database cannot support an outbox table or CDC (some managed DBs restrict schema changes)
- Event volume is extremely high and polling latency is unacceptable (prefer CDC in that case)

**Failure modes to design for:**
- Relay process failure (idempotent event publishing; mark outbox rows as published after ack)
- Outbox table growth (purge published rows on a schedule; alert on row age)
- CDC lag (monitor replication lag; set SLA on max acceptable lag)

**Cloud-native service mapping:**

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| CDC / relay | DMS + Kinesis or Debezium on ECS | Azure Database for PostgreSQL logical replication + Functions | Datastream + Pub/Sub |
| Outbox polling | Lambda on schedule | Functions timer trigger | Cloud Scheduler + Cloud Functions |

---

### CQRS — Command Query Responsibility Segregation

**Intent:** Separate the write model (commands that change state) from the read model (queries
that return data). Each side can be scaled, stored, and optimized independently.

**Use when:**
- Read and write loads are asymmetric (many more reads than writes, or vice versa)
- Read models need denormalization, aggregation, or a different storage format than the write model
- Multiple read representations of the same data are needed by different consumers

**Do NOT use when:**
- The domain is simple CRUD with symmetric read/write patterns
- The team lacks experience with eventual consistency between write and read models
- The additional operational complexity outweighs the scalability benefit

**Failure modes to design for:**
- Read model lag (the read model is eventually consistent; document the expected lag SLA)
- Read model rebuild (design for full rebuild from event log or snapshot; test it)
- Projection failure (failed projection update = stale read model; alert on projection error rate)

**Cloud-native service mapping:**

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Write store | RDS / DynamoDB / Aurora | Cosmos DB / Azure SQL | Cloud Spanner / Firestore |
| Event stream | Kinesis / EventBridge Pipes | Event Hub / Service Bus | Pub/Sub |
| Read store | OpenSearch / DynamoDB / ElastiCache | Azure Cognitive Search / Cosmos DB | BigQuery / Memorystore |
| Projection compute | Lambda | Functions | Cloud Functions / Dataflow |

---

### Event sourcing

**Intent:** Store application state as an immutable, append-only sequence of events. Current
state is derived by replaying the event log. Supports full audit trail and temporal queries.

**Use when:**
- A complete audit trail of every state change is a hard requirement
- Temporal queries ("what was the state at time T?") are needed
- The domain benefits from event-driven projections (CQRS pairs naturally with event sourcing)

**Do NOT use when:**
- The domain is simple CRUD; the operational overhead is not justified
- The team does not have event sourcing operational experience (event schema migration is hard)
- GDPR or right-to-erasure requirements make immutable event logs legally problematic without
  additional design (e.g. crypto-shredding)

**Failure modes to design for:**
- Event schema evolution (use versioned event types; never mutate past events)
- Snapshot staleness (rebuild from snapshot + delta; test snapshot creation and restore)
- Log compaction (design a retention and compaction strategy before going to production)

---

## Structural patterns

### Strangler fig

**Intent:** Incrementally replace a legacy system by routing traffic through a facade. New
functionality is implemented in new services behind the facade; old functionality is proxied to
the legacy system until replaced.

**Use when:**
- Migrating a large monolith to services without a big-bang rewrite
- The legacy system has clear seams (HTTP routes, message types, database tables) to route at
- Risk tolerance is low — each increment is independently deployable and reversible

**Do NOT use when:**
- The system is greenfield (no legacy to strangle)
- The legacy system has no routing seam (deeply embedded, no API layer)
- The migration timeline is so short that the facade adds more complexity than it removes

**Failure modes to design for:**
- Facade as single point of failure (deploy facade with HA; test failover to legacy path)
- State divergence between old and new systems during parallel operation (define a canonical source
  of truth per data entity and document it in the spec)
- Routing rule complexity (keep routing logic in configuration, not code; version it)

---

### Bulkhead

**Intent:** Partition resources (thread pools, connection pools, queues, compute instances) so
that a failure or overload in one partition does not cascade to others.

**Use when:**
- Multiple downstream integrations have different criticality levels
- Overload in one integration path (e.g. a slow data warehouse) must not starve another
  (e.g. the validation step)
- SLAs differ significantly between processing paths

**Cloud-native service mapping:**

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Queue-level bulkhead | Separate SQS queues per criticality | Separate Service Bus queues/topics | Separate Pub/Sub subscriptions |
| Compute-level bulkhead | Separate Lambda concurrency limits | Separate Function Apps or slots | Separate Cloud Run services |

---

### Circuit breaker

**Intent:** Wrap calls to a downstream service. After N consecutive failures, open the circuit
(stop calling, return a fallback immediately). After a timeout, probe with a single request.
If it succeeds, close the circuit.

**Use when:**
- Protecting against slow or intermittently failing downstream dependencies
- The fallback behavior (cached response, degraded mode, queue for retry) is defined

**Do NOT use when:**
- The downstream is synchronous and fast — the overhead is not justified
- No fallback exists and the calling service must fail anyway — a circuit breaker only delays it

**States:** Closed (normal) → Open (failing, returning fallback) → Half-open (probing)

---

## Anti-patterns

| Anti-pattern | What it looks like | Risk |
|---|---|---|
| **Distributed monolith** | Microservices that must be deployed together or share a database | Combines the operational complexity of services with the coupling of a monolith |
| **Chatty choreography** | 10+ services each subscribing to every other service's events | Implicit state machine; impossible to trace a transaction; cascade failures |
| **Synchronous saga** | Using HTTP calls instead of async messaging between saga steps | One slow step blocks the whole saga; retry storms on failure |
| **Shared mutable state** | Multiple services writing to the same table | Write conflicts, coupling, and schema change risk |
| **God orchestrator** | A single orchestrator that encodes all business logic | Becomes a monolith; defeats the purpose of service decomposition |
| **Event without schema** | Publishing raw JSON blobs with no schema contract | Schema drift breaks consumers silently; impossible to evolve safely |
| **LLM per document** | Invoking LLM synchronously for each document as it arrives | Per-call overhead dominates; cost and latency spike under load; use Batch Aggregator instead |
| **Shared Iceberg credentials** | One long-lived IAM role or SAS token shared across Snowflake and Databricks | Blast radius on credential leak; no per-engine audit trail; use credential vending |
| **Reconciliation as afterthought** | Audit ledger added post-launch without atomic writes | Ledger diverges from actual state under partial failures; impossible to trust |

---

## Serverless Batch Aggregator pattern

**Intent:** Buffer individually validated documents in a transient store. When a trigger fires
(time window, document count, or payload size), atomically move the batch to the LLM orchestrator
as a single batch job — reducing per-call overhead and LLM API cost.

**Use when:**
- Documents arrive continuously but LLM processing is more cost-efficient in batches
- Cloud LLM service offers a batch API (Bedrock Batch Inference, Azure OpenAI Batch, Vertex AI Batch Prediction)
- End-to-end latency requirement is minutes, not seconds

**Do NOT use when:**
- Per-document latency < 5 s is required (use synchronous inline LLM call)
- Document volume is low enough that batching adds complexity without cost benefit

**Failure modes to design for:**
- Buffer saturation (document volume exceeds buffer capacity before batch trigger): implement overflow split — emit multiple batch jobs when buffer exceeds max size
- Partial batch failure (N of M documents fail in a batch run): write per-document status to reconciliation ledger; DLQ failed docs individually; do not re-run the whole batch
- Timer misfire / missed trigger: reconciliation worker detects documents in VALID state with no batch_id after TTL; auto-enqueues a new batch
- Orphaned batch items on region failover: buffer must be durable (DynamoDB / Cosmos DB / Firestore); drain before failover, or use idempotent replay

**Cloud-native service mapping:**

| Component | AWS | Azure | GCP |
|---|---|---|---|
| Upload trigger | S3 Event → EventBridge | Blob Event → Event Grid | GCS Notification → Eventarc |
| Queue | SQS Standard | Service Bus Queue | Pub/Sub |
| Validator | Lambda | Azure Functions | Cloud Run function |
| Document buffer | DynamoDB | Cosmos DB / Service Bus Session | Firestore |
| Batch orchestrator | Step Functions Distributed Map | Durable Functions / Logic Apps | Cloud Workflows + Cloud Tasks |
| LLM batch API | Bedrock Batch Inference | Azure OpenAI Batch API | Vertex AI Batch Prediction |

---

## Apache Iceberg multi-engine interoperability pattern

**Intent:** Store processed output as Apache Iceberg tables in cloud object storage. Expose a
single REST Catalog endpoint so both Snowflake and Databricks can read and write without
duplicating data or maintaining separate copies.

**Use when:**
- Both Snowflake and Databricks must query the same processed output
- Open table format portability is a requirement (no vendor lock-in on storage format)
- Storage cost consolidation is a goal (one copy of Parquet files, multiple readers)

**Do NOT use when:**
- Only one engine (Snowflake or Databricks) needs access — use native format of that engine
- Data volume is small enough that duplication is cheaper than catalog infrastructure

**Failure modes to design for:**
- Catalog unavailability: Snowflake and Databricks fall back to read-only direct storage if catalog supports it; document fallback behavior
- Credential vending failure: short-lived token generation fails → writer cannot commit; retry with exponential backoff; alert on vending failures > threshold
- Schema evolution conflict: one engine adds a column the other doesn't handle → use Iceberg schema evolution with full backward/forward compatibility; test both engines on schema changes
- Concurrent writes from multiple engines: Iceberg optimistic concurrency control handles this natively in v2; document max retry count for commit conflicts

**Cloud-native service mapping:**

| Component | AWS | Azure | GCP |
|---|---|---|---|
| REST Catalog | Glue Iceberg REST endpoint | Apache Polaris (OSS) | Apache Polaris (OSS) or Databricks Unity |
| Object storage | S3 | Azure Data Lake Storage Gen2 | Cloud Storage |
| Credential vending | STS `GetTemporaryGlueTableCredentials` | User Delegation SAS (1 h TTL) | Short-lived SA token (1 h TTL) |
| Snowflake access | `EXTERNAL VOLUME` + catalog integration | Same | Same |
| Databricks access | Unity Catalog foreign catalog | Same | Same |

---

## Snowflake Cortex integration pattern

**Intent:** Execute LLM summarization inside Snowflake's compute boundary (Path A) or load
externally-generated summaries via Snowpipe Streaming (Path B). Select based on model
availability and data proximity.

**Path A — In-engine Cortex (preferred when data is already in Snowflake):**

```
Validated document text loaded to Snowflake staging table
  → Snowpark / SQL: SELECT SNOWFLAKE.CORTEX.SUMMARIZE(doc_text) AS summary
  → Result written to output table in same database
```

**Path B — External LLM → Snowpipe Streaming:**

```
Validated document → Cloud LLM (Bedrock / Azure OpenAI / Vertex AI)
  → Summary JSON → Snowpipe Streaming ingest channel → Snowflake output table
  (latency: < 1 min; auth: Snowflake key-pair via Secrets Manager)
```

**Use when (Path A):** Document text is already in Snowflake; Cortex supports required model in approved region; cost efficiency is priority.
**Use when (Path B):** Cortex does not offer the required model; approved region lacks Cortex availability; real-time streaming latency required.

**Failure modes to design for:**
- Cortex model not available in approved region: fall back to Path B automatically; document fallback model hierarchy in prompt spec
- Snowpipe Streaming channel lag: monitor channel offset lag; alert when lag exceeds SLA; channel is stateful — do not recreate without draining
- Key-pair auth expiry: automate key rotation via Secrets Manager; rotation must update both Secrets Manager and Snowflake user's RSA_PUBLIC_KEY property atomically

---

## End-to-end reconciliation pattern

**Intent:** Maintain an immutable audit ledger with a row per document tracking every stage
(ingested → validated → batched → LLM complete → Snowflake synced → Iceberg committed).
A scheduled reconciliation worker detects discrepancies and alerts or auto-replays.

**Use when:**
- End-to-end auditability is a compliance requirement
- Partial pipeline failures must be detected and auto-recovered without human intervention
- Multiple downstream systems (Snowflake, Databricks, Iceberg) must eventually be consistent

**Failure modes to design for:**
- Reconciliation worker failure mid-run: worker is stateless; each run re-queries from ledger; safe to restart
- Ledger write failure during document transition: use atomic writes (DynamoDB conditional write / Cosmos DB optimistic concurrency / Firestore transaction); never transition state without ledger update
- False positive discrepancies (eventual consistency lag): add configurable grace period (e.g. 5 min) before flagging a VALID doc with no batch_id as discrepant
- Replay causing duplicate processing: all downstream consumers must be idempotent on doc_id; reconciliation replays must set a `replay_correlation_id` for deduplication

**Ledger schema:** see `03-enterprise-integrations.md` for the full DDL.

**Cloud-native service mapping for reconciliation worker:**

| Component | AWS | Azure | GCP |
|---|---|---|---|
| Scheduler | EventBridge Scheduler | Azure Logic Apps timer / Azure Functions timer trigger | Cloud Scheduler |
| Worker compute | Lambda | Azure Functions | Cloud Run job |
| Ledger storage | DynamoDB (or RDS for complex queries) | Cosmos DB / Azure SQL | Firestore / Cloud Spanner |
| Alert channel | SNS | Event Grid / Service Bus | Pub/Sub |
