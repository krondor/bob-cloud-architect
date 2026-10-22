<!-- always active -->

# Cost Optimization

A **Cost Model column is mandatory** in every component selection matrix — not optional.
Never produce a component selection matrix without it.

## Cost model column values

Use this vocabulary consistently:

| Term | Meaning |
|---|---|
| **Pay-per-request** | Scales with invocation count; near-zero at zero load |
| **Per-GB processed** | Scales with data volume regardless of compute time |
| **Reserved capacity** | Upfront/committed-use discount; best for predictable load |
| **On-demand** | No commitment; higher per-unit; best for variable/unpredictable load |
| **Per-seat / per-unit** | Fixed cost per user, tenant, or provisioned unit |
| **Egress-dominant** | Primary cost driver is data transfer out of cloud or across regions |
| **Idle cost** | Cost incurred when service runs but is not processing |
| **Token-based** | Cost per input/output token (LLM services) |
| **Serverless (scale-to-zero)** | Near-zero idle; pay only during active processing |

---

## Compute cost patterns

| Model | Cost pattern | Best for |
|---|---|---|
| Serverless (Lambda / Functions / Cloud Run functions) | Pay-per-request; no idle | Bursty, event-driven, unpredictable volume |
| Container scale-to-zero (Fargate / Container Apps / Cloud Run) | Per vCPU-second; near-zero idle | Variable load; longer-running tasks; custom runtimes |
| Always-on VM / managed instance | Idle cost always present; reserved discount available | Predictable, sustained load; stateful workloads |
| Spot / preemptible | ~60–90% discount; interruption risk | Batch, fault-tolerant, non-time-sensitive (e.g. reconciliation worker) |

---

## Data transfer cost rules

| Pattern | Cost impact | Rule |
|---|---|---|
| Intra-region, same VPC | Free or negligible | No note required |
| Cross-AZ within region | Low but non-zero | Note in design |
| Cross-region (same cloud) | Moderate | Include data transfer cost note |
| Internet egress (cloud → external) | Highest | Flag as primary cost driver |
| Cross-cloud (cloud A → cloud B) | Internet egress on both sides | Flag as open decision if volumes unknown |

**Rule:** Any architecture moving large data volumes across regions or to external systems must
include a data transfer cost note. Flag as open decision if volumes are unknown.

---

## Storage tier selection

| Tier | Use when |
|---|---|
| Hot / Standard | Frequently accessed; latency-sensitive |
| Cool / Infrequent Access | Accessed < once/month; lower storage, higher retrieval |
| Archive / Glacier / Coldline | Compliance retention; rarely or never accessed |
| Intelligent-tiering / Lifecycle | Unknown/variable access patterns |

Always specify storage tier and lifecycle policy for compliance-retained data (Iceberg Parquet, reconciliation ledger backups).

---

## LLM token cost note

Every LLM integration must include a rough order-of-magnitude token cost estimate:
- Input tokens per document (estimate based on average document size)
- Output tokens per summary
- Cloud LLM cost: price per 1M tokens × estimated volume = monthly cost range
- Snowflake Cortex cost: Snowflake credits per token (reference current Cortex credit table)

Do not produce specific dollar estimates. Produce cost *patterns* and relative comparisons only.
When the spec requires a dollar estimate, note it as an open decision requiring a FinOps review.

---

## Cost governance controls

| Control | AWS | Azure | GCP |
|---|---|---|---|
| Resource tagging | Required tags: `env`, `project`, `owner`, `cost-center` | Same via Azure tags | Same via GCP labels (apply per resource; project labels do not propagate) |
| Budget alerting | AWS Budgets — SNS alert at 80% and 100% | Azure Cost Management budget alerts | GCP Budgets — email thresholds + Pub/Sub for programmatic response |
| Cost allocation | Cost Explorer tag-based grouping | Cost Management + Billing with resource groups | Cloud Billing reports with label filters |
| Rightsizing | Compute Optimizer | Azure Advisor | Recommender API |

---

## Multi-region cost multiplier

| Pattern | Cost multiplier rule of thumb |
|---|---|
| Active-active | ~2× compute + storage + cross-region replication cost |
| Active-passive (hot standby) | ~1.5–2× compute (standby at reduced capacity) |
| Pilot-light | ~1.1–1.3× (minimal standby; scale-up on failover) |
| Data replication | Add per-GB replication cost for every cross-region DB or object store |

Always flag multi-region data replication as an egress-dominant cost driver.
