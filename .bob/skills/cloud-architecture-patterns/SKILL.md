---
name: cloud-architecture-patterns
version: 1.3.1
description: >
  Pattern catalog for enterprise cloud architecture. Covers event-driven, data, structural,
  and integration patterns with cloud-native service mappings for AWS, Azure, and GCP.
  Includes decision trees, anti-patterns, failure modes, and cloud service reference tables.
when_to_use: >
  Load when selecting an architecture pattern, when the spec describes event-driven, streaming,
  or data pipeline requirements, when producing a component selection matrix, or when HA/DR
  pattern selection and cost detail are needed.
---

# Cloud Architecture Patterns

## Skill navigation

| Section | When to use |
|---|---|
| [Pattern decision tree](#pattern-decision-tree) | First step for any new system — narrow to 1–3 candidates |
| [Event-driven patterns](#event-driven-patterns) | Choreography, saga, outbox, CQRS, event sourcing |
| [Structural patterns](#structural-patterns) | Strangler fig, bulkhead, circuit breaker |
| [Anti-patterns](#anti-patterns) | Quick sanity check before committing to a pattern |
| [Cloud service reference](#cloud-service-reference) | Service matrix: compute, storage, queuing, KMS, monitoring, multi-region DB |
| [Integration pattern mappings](#integration-pattern-mappings) | Per-cloud service tables for ingest, async, API, and orchestration patterns |
| [HA/DR reference](#hadr-reference) | Pattern selection by RPO/RTO, failover levels, common gaps |
| [Cost reference](#cost-reference) | Compute models, storage tiers, cost governance, multi-region multipliers |
| [Profile-specific patterns](#profile-specific-patterns) | Batch aggregator, Iceberg, Cortex, reconciliation: in `document-processing-profile` |

---

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
Is this a simple application (single team, one DB, synchronous workflows, no cross-service sagas)?
├── Yes → Use a straightforward request/response service with a single managed DB.
│         Add async messaging only when a specific decoupling requirement is identified.
│         Do not add CQRS, event sourcing, or saga until there is a concrete need.
└── No  → Is the system processing discrete events or documents one at a time?
          ├── Yes → Is rollback across services required (compensating transactions)?
          │         ├── Yes  → Event Orchestration (Saga); add a FIFO queue only if step ordering matters
          │         └── No   → Event Choreography
          │                    plus Transactional Outbox if DB write and event publish must be atomic
          └── No  → Is the system reading and writing the same data model at different rates?
                    ├── Yes → CQRS (with or without Event Sourcing)
                    └── No  → Is the system replacing a legacy monolith incrementally?
                              ├── Yes → Strangler Fig
                              └── No  → No pattern in this catalog applies. Keep the simplest design
                                        and record the open question as an ADR or Open Decision.
                                        Cross-domain data sharing and streaming analytics are not
                                        covered here; do not invent a pattern recommendation.
```

If the spec has the document-processing profile (batch LLM summarisation of arriving documents),
the profile skill adds the Serverless Batch Aggregator as a candidate.

> **Note on choreography and sagas:** Choreography does not categorically ban compensating
> transactions. A choreography-based saga — where each service publishes success or failure events
> and downstream services react — is valid when audit trail visibility is not a hard requirement
> and the flow has ≤ 4–5 steps. Use orchestration-based saga when you need a single coordinator,
> explicit rollback control, or a clear audit trail of each step's outcome.

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
| Async step trigger | SQS + Lambda | Service Bus + Functions | Pub/Sub + Cloud Run functions |

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
| Outbox polling | Lambda on schedule | Functions timer trigger | Cloud Scheduler + Cloud Run functions |

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
| Read store | OpenSearch / DynamoDB / ElastiCache | Azure AI Search / Cosmos DB | BigQuery / Memorystore |
| Projection compute | Lambda | Functions | Cloud Run functions / Dataflow |

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

---

## Cloud service reference

Cloud service mappings for component selection matrices. Include only the clouds declared in the spec.

| Capability | AWS | Azure | GCP | HA / DR note |
|---|---|---|---|---|
| Object storage | S3 | Blob Storage | Cloud Storage | S3 CRR / Blob GRS-GZRS / CS dual-region |
| Storage event notification | S3 Event Notifications | Event Grid (Blob events) | Eventarc (GCS trigger) | |
| Event bus / routing | EventBridge | Event Grid | Eventarc | |
| Messaging queue (point-to-point) | SQS | Service Bus Queue | Cloud Tasks | SQS has no native cross-region; fan out via SNS |
| Messaging queue (pub-sub / fan-out) | SNS + SQS | Service Bus Topics / Event Hubs | Pub/Sub | Pub/Sub is global; set message storage policy for residency |
| Serverless compute | Lambda | Azure Functions | Cloud Run functions | |
| Container compute (scale-to-zero) | ECS Fargate | Container Apps | Cloud Run | |
| Workflow / batch orchestration | Step Functions (Distributed Map for batch) | Durable Functions / Logic Apps | Workflows + Cloud Tasks | Use Step Functions Standard (not Express) for sagas |
| Secrets management | Secrets Manager | Key Vault (secrets) | Secret Manager | |
| KMS / CMK | KMS | Key Vault (keys) | Cloud KMS | |
| LLM service | Bedrock | Azure OpenAI Service | Vertex AI (Gemini) | |
| LLM batch invocation | Bedrock Batch Inference | Azure OpenAI Batch API | Vertex AI Batch Prediction | |
| In-database LLM | — | — | BigQuery ML (GENERATE_TEXT) | Snowflake Cortex covers all three via Snowflake integration |
| Iceberg REST Catalog | Glue Iceberg REST endpoint | — (use Apache Polaris OSS) | — (use Apache Polaris OSS or Databricks Unity) | |
| Container registry | ECR | ACR | Artifact Registry | |
| Monitoring | CloudWatch | Azure Monitor | Cloud Monitoring | |
| Distributed tracing | X-Ray | Application Insights | Cloud Trace | |
| VPC networking | VPC | VNet | VPC | |
| Private endpoints | PrivateLink | Private Endpoint | Private Service Connect | |
| Global DNS / traffic routing | Route 53 (latency/failover) | Traffic Manager / Front Door | Cloud DNS + Cloud Load Balancing | |
| Global load balancer | Global Accelerator | Azure Front Door | Cloud Load Balancing (global anycast) | |
| Multi-region relational DB | Aurora Global Database | Cosmos DB multi-region / Azure SQL geo-replication | Cloud Spanner (multi-region) / AlloyDB cross-region | |
| Multi-region key-value / document | DynamoDB Global Tables | Cosmos DB | Firestore (multi-region) | |
| Health monitoring | Route 53 health checks + CloudWatch | Azure Monitor + Traffic Manager probes | Cloud Monitoring uptime checks | |
| Cost governance | AWS Budgets + Cost Explorer | Azure Cost Management | GCP Budgets + Billing reports | |

---

## Integration pattern mappings

### Event-driven ingest

Use when: upstream systems emit events or files that trigger downstream processing.

| Cloud | Upload / event trigger | Routing | Processing target |
|---|---|---|---|
| **AWS** | S3 Event → EventBridge | EventBridge rule | Lambda / ECS Fargate / Step Functions |
| **Azure** | Blob Event → Event Grid | Event Grid subscription | Azure Functions / Container Apps / Logic Apps |
| **GCP** | GCS Notification → Eventarc | Eventarc trigger | Cloud Run functions / Cloud Run / Workflows |

### Async messaging

Use when: producer and consumer must be decoupled; at-least-once or exactly-once delivery required.

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Point-to-point queue | SQS Standard | Service Bus Queue | Cloud Tasks |
| Pub/sub fan-out | SNS + SQS | Service Bus Topics / Event Hubs | Pub/Sub |
| Ordering guarantee | SQS FIFO | Service Bus Session | Pub/Sub with ordering key |
| Dead-letter | SQS DLQ | Service Bus DLQ | Pub/Sub dead-letter topic |

**Rule:** Every async processing path must have a dead-letter destination and an alert on DLQ depth and message age.

### Request/response API

Use when: synchronous call with a defined request and response contract (REST, gRPC, GraphQL).

| Concern | Requirement |
|---|---|
| Auth | OAuth 2.0 client credentials or API key stored in secrets manager; no hardcoded credentials |
| Retry | Retry on 429 / 5xx with exponential backoff and jitter; never retry on 4xx except 429 |
| Circuit breaker | Required for any slow or intermittent downstream; document trip threshold and recovery interval |
| Schema | Request and response schemas versioned and documented in the deliverable |
| Observability | Log request ID, endpoint, status code, and latency; never log request payload content that may contain sensitive data |

### Workflow orchestration

Use when: multi-step cross-service process requires explicit sequencing, retry, and rollback (saga).

| Cloud | Orchestrator | Batch variant | Notes |
|---|---|---|---|
| **AWS** | Step Functions Standard | Step Functions Distributed Map | Standard for sagas (event history); Express for high-volume short tasks |
| **Azure** | Durable Functions / Logic Apps | Durable Functions Fan-out | Durable Functions for code-first; Logic Apps for low-code |
| **GCP** | Cloud Workflows | Cloud Workflows + Cloud Tasks | Workflows is synchronous-first; use Cloud Tasks for async steps |

---

## HA/DR reference

### HA pattern selection

| Pattern | RPO | RTO | Cost multiplier | Use when |
|---|---|---|---|---|
| **Active-active** | ~0 s | ~0 s | ~2× + replication | Both regions serve traffic; zero-downtime failover required |
| **Active-passive (hot standby)** | seconds–minutes | minutes | ~1.5–2× | Primary serves all traffic; warm standby can take over quickly |
| **Pilot-light** | minutes | 10–30 min | ~1.1–1.3× | Core components always running in DR; scale-up on failover |
| **Backup and restore** | hours | hours | ~1.05× | Low criticality; lowest cost |

### Failover levels

| Level | Mechanism | RTO order | Use when |
|---|---|---|---|
| DNS-level | Route 53 failover / Traffic Manager / Cloud DNS routing policy | 30–120 s (TTL-bound; set TTL ≤ 60 s) | External client failover acceptable within TTL propagation window |
| Load-balancer-level | ALB/NLB / Azure LB / Cloud Load Balancing | seconds (health check interval) | Active-active across AZs; sub-minute RTO within region |
| Application-level | Leader election, managed multi-region DB | sub-second to seconds | Stateful failover; session/transaction handoff required |

### Common HA design gaps

| Gap | Risk | Remediation |
|---|---|---|
| RPO/RTO not stated | Pattern chosen without knowing the requirement | Add as open decision; get business owner to sign off |
| Single-region DB with multi-region compute | Compute failover succeeds but DB unavailable | Use multi-region DB or explicitly document as known SPOF |
| DNS TTL too high | Failover exceeds RTO because clients cache old IP | Set TTL ≤ 60 s for failover-eligible records |
| No replication lag SLA | DR region has stale data; RPO violated without warning | Monitor replication lag; alert when lag exceeds RPO target |
| Failover never tested | Recovery procedure exists on paper but fails in practice | Include failover drill in implementation plan as required task before GA |
| Batch buffer overflow on failover | In-flight batch items lost during region switch | Document buffer drain strategy; prefer idempotent replay |

### Data residency documentation

When the spec states residency constraints:

| Field | Content |
|---|---|
| Data type | e.g. "patient records", "regulatory documents" |
| Residency constraint | e.g. "US only (contractual)" |
| Services affected | Every service that stores or processes this data type |
| Region selection | Approved region(s) for each affected service |
| Cross-region transfer | Whether transfer is ever permitted and under what conditions |

---

## Cost reference

### Compute cost patterns

| Model | Cost pattern | Best for |
|---|---|---|
| Serverless (Lambda / Functions / Cloud Run functions) | Pay-per-request; no idle | Bursty, event-driven, unpredictable volume |
| Container scale-to-zero (Fargate / Container Apps / Cloud Run) | Per vCPU-second; near-zero idle | Variable load; longer-running tasks; custom runtimes |
| Always-on VM / managed instance | Idle cost always present; reserved discount available | Predictable, sustained load; stateful workloads |
| Spot / preemptible | ~60–90% discount; interruption risk | Batch, fault-tolerant, non-time-sensitive |

### Data transfer cost patterns

| Pattern | Cost impact | Rule |
|---|---|---|
| Intra-region, same VPC | Free or negligible | No note required |
| Cross-AZ within region | Low but non-zero | Note in design |
| Cross-region (same cloud) | Moderate | Include data transfer cost note |
| Internet egress (cloud → external) | Highest | Flag as primary cost driver |
| Cross-cloud (cloud A → cloud B) | Internet egress on both sides | Flag as open decision if volumes unknown |

### Storage tier selection

| Tier | Use when |
|---|---|
| Hot / Standard | Frequently accessed; latency-sensitive |
| Cool / Infrequent Access | Accessed < once/month; lower storage, higher retrieval |
| Archive / Glacier / Coldline | Compliance retention; rarely or never accessed |
| Intelligent-tiering / Lifecycle | Unknown/variable access patterns |

Always specify storage tier and lifecycle policy for compliance-retained data.

### Cost governance controls

| Control | AWS | Azure | GCP |
|---|---|---|---|
| Resource tagging | Required tags: `env`, `project`, `owner`, `cost-center` | Same via Azure tags | Same via GCP labels (apply per resource; project labels do not propagate) |
| Budget alerting | AWS Budgets — SNS alert at 80% and 100% | Azure Cost Management budget alerts | GCP Budgets — email thresholds + Pub/Sub for programmatic response |
| Cost allocation | Cost Explorer tag-based grouping | Cost Management + Billing with resource groups | Cloud Billing reports with label filters |
| Rightsizing | Compute Optimizer | Azure Advisor | Recommender API |

### Multi-region cost multipliers

| Pattern | Cost multiplier rule of thumb |
|---|---|
| Active-active | ~2× compute + storage + cross-region replication cost |
| Active-passive (hot standby) | ~1.5–2× compute (standby at reduced capacity) |
| Pilot-light | ~1.1–1.3× (minimal standby; scale-up on failover) |
| Data replication | Add per-GB replication cost for every cross-region DB or object store |

Always flag multi-region data replication as an egress-dominant cost driver.

---

## Profile-specific patterns

Batch Aggregator, Apache Iceberg multi-engine interoperability, Snowflake Cortex, and
reconciliation-ledger patterns live in the `document-processing-profile` skill. Load that skill
when the spec declares `profile: document-processing`; do not apply those patterns otherwise.
