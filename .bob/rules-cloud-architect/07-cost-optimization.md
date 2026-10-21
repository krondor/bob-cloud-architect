<!-- load when: cost discussion, cost characterization, or cost trade-offs are mentioned; or when producing a final deliverable that includes a cost section -->

# Cost Optimization

Every architecture deliverable should include cost characterization when the spec involves
component selection. This file defines how to characterize cost without producing specific dollar
estimates (which require current pricing and usage volumes not available to the architect).

## When to include cost in a deliverable

| Trigger | What to produce |
|---|---|
| Component selection task | A cost model column in the component selection matrix |
| Spec explicitly asks for cost | A dedicated cost section in the deliverable |
| Comparing two architecture options | A relative cost comparison (not absolute) |
| Multi-region design | A cost multiplier note (multi-region ≈ 2× baseline plus data transfer) |

Do not produce specific dollar estimates. Produce cost *patterns* and relative comparisons only.
When the spec requires a dollar estimate, note it as an open decision requiring a FinOps review.

---

## Cost characterization vocabulary

Use these terms consistently so cost language is comparable across deliverables.

| Term | Meaning |
|---|---|
| **Pay-per-request** | Cost scales with invocation count; near-zero cost at zero load |
| **Per-GB processed** | Cost scales with data volume regardless of compute time |
| **Reserved capacity** | Upfront or committed-use discount; optimal when load is predictable |
| **On-demand** | No commitment; higher per-unit cost; optimal for variable or unpredictable load |
| **Per-seat / per-unit** | Fixed cost per user, tenant, or provisioned unit |
| **Egress-dominant** | The primary cost driver is data transfer out of the cloud or across regions |
| **Idle cost** | Cost incurred when the service is running but not processing (e.g. always-on VMs) |

---

## The three cost levers in every cloud architecture

### 1. Compute model

| Model | Cost pattern | Best for |
|---|---|---|
| Serverless (Lambda / Functions / Cloud Functions) | Pay-per-request; no idle cost | Bursty, event-driven, unpredictable volume |
| Container (ECS Fargate / Container Apps / Cloud Run) | Per vCPU-second; near-zero idle on scale-to-zero | Variable load; longer-running tasks; custom runtimes |
| Always-on VM / managed instance | Idle cost always present; reserved discount available | Predictable, sustained load; stateful workloads |
| Spot / preemptible / Spot VMs | 60–90% discount vs. on-demand; interruption risk | Batch, fault-tolerant, non-time-sensitive workloads |

### 2. Data transfer

Data transfer is frequently the largest unexpected cost driver in multi-cloud and multi-region architectures.

| Pattern | Cost impact |
|---|---|
| Intra-region, same VPC | Typically free or negligible |
| Cross-AZ within region | Low but non-zero on AWS and Azure; note in design |
| Cross-region (same cloud) | Moderate; multiplier on data-intensive pipelines |
| Internet egress (cloud → external) | Highest; primary cost driver for data export use cases |
| Cross-cloud (cloud A → cloud B) | Internet egress rates on both sides; significant for data mesh |

**Rule:** Any architecture that moves large volumes of data across regions or to external systems
must include a data transfer cost note. Flag it as an open decision if volumes are unknown.

### 3. Storage tier

| Tier pattern | Use when |
|---|---|
| Hot / Standard | Frequently accessed; latency-sensitive reads |
| Cool / Infrequent Access | Accessed less than once per month; lower storage cost, higher retrieval cost |
| Archive / Glacier / Coldline | Compliance retention; accessed rarely or never |
| Intelligent-tiering / Lifecycle policies | Unknown or variable access patterns; auto-moves objects between tiers |

Always specify the intended storage tier and a lifecycle policy for compliance-retained data.

---

## Managed vs. self-managed cost trade-off

| Factor | Managed service | Self-managed (e.g. Kafka on VMs) |
|---|---|---|
| Upfront cost | Higher per-unit | Lower per-unit |
| Operational cost | Included in price | Engineering time + on-call |
| Scaling cost | Pay-per-use or reserved | Over-provision or under-provision |
| Recommendation | Default choice unless a spec constraint prevents it | Only when portability, pricing model, or compliance requires it |

When recommending self-managed, document the total cost of ownership trade-off explicitly.

---

## Cost governance

Include the following in every architecture that will be deployed in a shared cloud account:

| Control | AWS | Azure | GCP |
|---|---|---|---|
| Resource tagging | Required tags: `env`, `project`, `owner`, `cost-center` | Same via Azure tags | Same via GCP labels |
| Budget alerting | AWS Budgets with SNS alert at 80% and 100% | Azure Cost Management budget alerts | GCP Budgets with Pub/Sub notification |
| Cost allocation | Cost Explorer with tag-based grouping | Cost Management + Billing with resource groups | Cloud Billing reports with label filters |
| Rightsizing | Compute Optimizer | Azure Advisor | Recommender API |

---

## Multi-region cost multiplier

When a spec requires multi-region deployment, apply the following rules of thumb:

- **Active-active:** ≈ 2× compute + storage cost, plus cross-region data replication cost
- **Active-passive (hot standby):** ≈ 1.5–2× compute cost (standby runs at reduced capacity)
- **Pilot-light:** ≈ 1.1–1.3× cost (minimal standby; scale-up on failover)
- **Data replication:** add per-GB replication cost for every cross-region database or object store

Always flag multi-region data replication as an egress-dominant cost driver in the deliverable.
