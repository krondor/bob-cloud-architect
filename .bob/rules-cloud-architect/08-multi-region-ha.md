<!-- load when: spec or task mentions high availability, disaster recovery, multi-region, RPO, RTO, failover, active-active, active-passive, or data residency -->

# Multi-Region and High Availability Design

Every production architecture must address HA and DR. This file defines the patterns, decision
criteria, and required deliverable content for multi-region and HA design.

## HA pattern selection

### Decision criteria

Choose the HA pattern based on the RPO/RTO targets in the spec. If they are not stated, surface
them as open decisions before producing the HA section.

| Pattern | RPO | RTO | Cost multiplier | Use when |
|---|---|---|---|---|
| **Active-active** | Near-zero (seconds) | Near-zero (seconds) | ~2× + replication | Both regions serve traffic simultaneously; zero-downtime failover required |
| **Active-passive (hot standby)** | Seconds to minutes | Minutes | ~1.5–2× | Primary region serves all traffic; standby is warm and can take over quickly |
| **Pilot-light** | Minutes | 10–30 minutes | ~1.1–1.3× | Core components always running in DR region; scale-up on failover |
| **Backup and restore** | Hours | Hours | ~1.05× | Low criticality; recovery from backup is acceptable; lowest cost |

**Rule:** Never choose a pattern without RPO/RTO targets. If the spec does not state them,
add them as open decisions before producing the HA section.

---

## Multi-region service mapping

Extend the base mapping in `02-multi-cloud-parity.md` with HA-relevant services.

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Global DNS / traffic routing | Route 53 (latency/failover routing) | Azure Traffic Manager / Front Door | Cloud DNS + Cloud Load Balancing |
| Global load balancer | Global Accelerator | Azure Front Door | Cloud Load Balancing (global) |
| Multi-region relational DB | Aurora Global Database | Cosmos DB (multi-region writes) / Azure SQL geo-replication | Cloud Spanner (multi-region) / AlloyDB cross-region replica |
| Multi-region key-value / document | DynamoDB Global Tables | Cosmos DB | Firestore (multi-region) |
| Multi-region object storage | S3 Cross-Region Replication | Azure Blob Storage geo-redundant (GRS/GZRS) | Cloud Storage dual-region / multi-region buckets |
| Multi-region queue / messaging | SQS (no native cross-region; replicate via Lambda) | Service Bus Geo-Disaster Recovery pairing | Pub/Sub (global by default) |
| Health monitoring | Route 53 health checks + CloudWatch | Azure Monitor + Traffic Manager probes | Cloud Monitoring uptime checks |
| Failover orchestration | Route 53 DNS failover | Traffic Manager automatic failover | Cloud Load Balancing backend failover |

---

## Failover design levels

Design failover at three levels. Document which levels are in scope for the active spec.

### DNS-level failover

- Fastest to recover for external clients (DNS TTL ≤ 60 seconds)
- Requires health checks on the primary endpoint
- Not suitable when TTL propagation is unacceptable (sub-minute RTO)
- Tools: Route 53 failover routing, Azure Traffic Manager, Cloud DNS + health checks

### Load-balancer-level failover

- Sub-second failover for traffic already in-region
- Requires backend health checks and multiple healthy targets
- Appropriate when active-active across AZs is sufficient and multi-region is not needed
- Tools: ALB / NLB (AWS), Azure Load Balancer / Application Gateway, Cloud Load Balancing (GCP)

### Application-level failover

- Most complex; handles stateful failover (sessions, in-flight transactions)
- Required when the application must coordinate its own leader election or state handoff
- Use managed services (Aurora Global Database, Cosmos DB) to delegate this complexity where possible

---

## Data residency

When the spec states data residency constraints, reflect them in region selection for every
service. Document the following for each constrained data type:

| Field | Content |
|---|---|
| Data type | e.g. "patient records", "financial transactions" |
| Residency constraint | e.g. "EU only (GDPR Article 44)", "US only (contractual)" |
| Services affected | List every service that stores or processes this data type |
| Region selection | The approved region(s) for each affected service |
| Cross-region transfer | Whether transfer is ever permitted and under what conditions |

**Rule:** If data residency constraints are stated in the spec, every service in the deliverable
must have an explicit region assignment. Do not leave region as "TBD" for constrained data types.

---

## Required HA section in the deliverable

When an HA or DR task is in scope, add the following section to the architecture document
(insert after Section 6 — Failure Handling Design in the standard deliverable format):

```
## High Availability and Disaster Recovery

### RPO and RTO targets
| Tier | RPO | RTO | Source |
|---|---|---|---|
| <component or data type> | <target> | <target> | <spec section or open decision #> |

### HA pattern
<chosen pattern and rationale>

### Multi-region topology diagram
<Mermaid flowchart showing primary region, DR region, replication paths, and failover routing>

### Failover runbook pointer
<Reference to the runbook location — not the full content>

### Data residency mapping
<Table per constrained data type — or "no residency constraints stated in spec">
```

---

## Common HA design gaps

| Gap | Risk | Remediation |
|---|---|---|
| RPO/RTO not stated | HA pattern chosen without knowing the requirement; may be over- or under-designed | Add as open decision; get business owner to sign off |
| Single-region database with multi-region compute | Compute failover succeeds but DB is unavailable; illusory HA | Use multi-region DB or explicitly document the single-region DB as a known single point of failure |
| DNS TTL too high | Failover takes longer than RTO because clients cache the old IP | Set TTL ≤ 60s for failover-eligible records; document the tradeoff |
| No data replication lag SLA | DR region has stale data; RPO is violated without warning | Monitor replication lag; alert when lag exceeds RPO target |
| Failover never tested | Recovery procedure exists on paper but fails in practice | Include "failover drill" in the implementation plan as a required task before GA |
