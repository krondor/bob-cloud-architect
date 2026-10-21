---
name: cloud-architecture-patterns
version: 1.0.0
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
| Orchestrator | Step Functions (Standard) | Durable Functions / Logic Apps | Workflows |
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
