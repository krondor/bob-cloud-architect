<!-- always active -->

# Multi-Cloud Parity & HA Service Mapping

Every architecture output covers AWS, Azure, and GCP with equal depth unless the selected spec
explicitly reduces scope. State the cloud-agnostic pattern before rendering cloud-specific
implementations.

## Comprehensive service matrix

| Capability | AWS | Azure | GCP | HA / DR note |
|---|---|---|---|---|
| Object storage | S3 | Blob Storage | Cloud Storage | S3 CRR / Blob GRS-GZRS / CS dual-region |
| Storage event notification | S3 Event Notifications | Event Grid (Blob events) | Eventarc (GCS trigger) | |
| Event bus / routing | EventBridge | Event Grid | Eventarc | |
| Messaging queue (point-to-point) | SQS | Service Bus Queue | Cloud Tasks | SQS has no native cross-region; fan out via SNS |
| Messaging queue (pub-sub / fan-out) | SNS + SQS | Service Bus Topics / Event Hubs | Pub/Sub | Pub/Sub is global; set message storage policy for residency |
| Serverless compute | Lambda | Azure Functions | Cloud Run functions (deploy via Cloud Run Admin API) | |
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

## HA pattern selection

| Pattern | RPO | RTO | Cost multiplier | Use when |
|---|---|---|---|---|
| **Active-active** | ~0 s | ~0 s | ~2× + replication | Both regions serve traffic; zero-downtime failover required |
| **Active-passive (hot standby)** | seconds–minutes | minutes | ~1.5–2× | Primary serves all traffic; warm standby can take over quickly |
| **Pilot-light** | minutes | 10–30 min | ~1.1–1.3× | Core components always running in DR; scale-up on failover |
| **Backup and restore** | hours | hours | ~1.05× | Low criticality; lowest cost |

**Rule:** Never choose a pattern without RPO/RTO targets. If the spec omits them, add as open decisions.

## Multi-region failover levels

| Level | Mechanism | RTO order | Use when |
|---|---|---|---|
| DNS-level | Route 53 failover / Traffic Manager / Cloud DNS routing policy | 30–120 s (TTL-bound; set TTL ≤ 60 s) | External client failover acceptable within TTL propagation window |
| Load-balancer-level | ALB/NLB / Azure LB / Cloud Load Balancing | seconds (health check interval) | Active-active across AZs; sub-minute RTO within region |
| Application-level | Leader election, managed multi-region DB | sub-second to seconds | Stateful failover; session/transaction handoff required |

## Data residency rules

When the spec states residency constraints:
- Every service must have an explicit region assignment — no "TBD" for constrained data types.
- Document: data type, residency constraint, affected services, approved regions, cross-region transfer policy.
- GCP: set Pub/Sub message storage policy; Cloud Storage bucket location; use VPC Service Controls for boundary enforcement.

## Cloud-agnostic first rule

State the cloud-agnostic pattern (e.g. "object store → event notification → queue → serverless
validator → buffer → batch orchestrator → LLM → lakehouse") before rendering cloud-specific
implementations. Only recommend cloud-agnostic middleware (Kafka, Pulsar, Temporal) when the spec
requires cross-cloud portability or the team already operates it at lower TCO than managed services.
