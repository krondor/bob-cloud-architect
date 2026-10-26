<!-- always active -->

# Enterprise Integration Architecture

Every integration target in the selected spec must be documented with the six required fields below.
Do not assume any particular set of targets — the list is defined by the spec.

## Required fields per integration

| Field | Content |
|---|---|
| Connection mechanism | SDK, REST API, connector, JDBC, streaming, or webhook |
| Auth model | Credential type, rotation policy, secret store reference |
| Data flow direction | Inbound, outbound, or bidirectional |
| Failure behavior | On connectivity loss, auth failure, schema mismatch |
| Observability | Metrics, traces, logs emitted by this integration |
| Data governance | Data classification, encryption in transit, access control |

Present each integration as a named subsection: table of 6 fields + brief prose on the connection pattern.

---

## Common integration patterns

### Event-driven ingest pattern

Use when: upstream systems emit events or files that trigger downstream processing.

| Cloud | Upload / event trigger | Routing | Processing target |
|---|---|---|---|
| **AWS** | S3 Event → EventBridge | EventBridge rule | Lambda / ECS Fargate / Step Functions |
| **Azure** | Blob Event → Event Grid | Event Grid subscription | Azure Functions / Container Apps / Logic Apps |
| **GCP** | GCS Notification → Eventarc | Eventarc trigger | Cloud Run functions / Cloud Run / Workflows |

---

### Async messaging pattern

Use when: producer and consumer must be decoupled; at-least-once or exactly-once delivery required.

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Point-to-point queue | SQS Standard | Service Bus Queue | Cloud Tasks |
| Pub/sub fan-out | SNS + SQS | Service Bus Topics / Event Hubs | Pub/Sub |
| Ordering guarantee | SQS FIFO | Service Bus Session | Pub/Sub with ordering key |
| Dead-letter | SQS DLQ | Service Bus DLQ | Pub/Sub dead-letter topic |

**Rule:** Every async processing path must have a dead-letter destination and an alert on DLQ depth and message age.

---

### Request/response API pattern

Use when: synchronous call with a defined request and response contract (REST, gRPC, GraphQL).

| Concern | Requirement |
|---|---|
| Auth | OAuth 2.0 client credentials or API key stored in secrets manager; no hardcoded credentials |
| Retry | Retry on 429 / 5xx with exponential backoff and jitter; never retry on 4xx except 429 |
| Circuit breaker | Required for any slow or intermittent downstream; document trip threshold and recovery interval |
| Schema | Request and response schemas versioned and documented in the deliverable |
| Observability | Log request ID, endpoint, status code, and latency; never log request payload content that may contain sensitive data |

---

### Workflow orchestration pattern

Use when: multi-step cross-service process requires explicit sequencing, retry, and rollback (saga).

| Cloud | Orchestrator | Batch variant | Notes |
|---|---|---|---|
| **AWS** | Step Functions Standard | Step Functions Distributed Map | Standard for sagas (event history); Express for high-volume short tasks |
| **Azure** | Durable Functions / Logic Apps | Durable Functions Fan-out | Durable Functions for code-first; Logic Apps for low-code |
| **GCP** | Cloud Workflows | Cloud Workflows + Cloud Tasks | Workflows is synchronous-first; use Cloud Tasks for async steps |

---

## External system integration rules

| Rule | Detail |
|---|---|
| No shared credentials | Each integration uses its own least-privilege credential; never share a service account or API key across integrations |
| Secrets store only | All credentials stored in cloud-native secrets store; referenced by name/ARN/URI in architecture; never embedded |
| Schema contract documented | Every integration defines the expected request/response or event schema in the deliverable |
| Failure behavior explicit | Every integration documents what happens on connectivity loss, auth failure, and schema mismatch |
| Retry not on logic errors | Retry only on transient errors (network, 429, 5xx); never retry on schema validation failures or auth denials |
