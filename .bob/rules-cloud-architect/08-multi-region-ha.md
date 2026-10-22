<!-- always active -->

# Multi-Region and High Availability Design

> **Note:** HA pattern selection criteria and multi-region service mapping are consolidated in
> `02-multi-cloud-parity.md`. This file provides detailed failover design guidance and required
> deliverable content for multi-region and HA tasks.

## Failover design levels

Design failover at three levels. Document which levels are in scope for the selected spec.

### DNS-level failover

| Detail | Value |
|---|---|
| Recovery order | 30–120 s (TTL-bound) |
| Requirement | Health checks on primary endpoint; set TTL ≤ 60 s |
| Limitation | Not suitable when sub-minute RTO is required |
| Tools | Route 53 failover routing / Azure Traffic Manager / Cloud DNS routing policy (health-checks internal LBs and external endpoints only; automatic failover does not occur when geofencing is enabled) |

### Load-balancer-level failover

| Detail | Value |
|---|---|
| Recovery order | Seconds (health check interval + threshold) |
| Requirement | Multiple healthy backend targets; health checks configured |
| Use when | Active-active across AZs; sub-minute RTO within region |
| Tools | ALB/NLB / Azure Application Gateway + LB / Cloud Load Balancing (single anycast IP; no DNS change on failover) |

### Application-level failover

| Detail | Value |
|---|---|
| Recovery order | Sub-second to seconds |
| Use when | Stateful failover; sessions, in-flight transactions, leader election |
| Recommendation | Delegate to managed multi-region services (Aurora Global, Cosmos DB, Cloud Spanner) |

---

## Common HA design gaps

| Gap | Risk | Remediation |
|---|---|---|
| RPO/RTO not stated | Pattern chosen without knowing the requirement | Add as open decision; get business owner to sign off |
| Single-region DB with multi-region compute | Compute failover succeeds but DB unavailable | Use multi-region DB or explicitly document as known SPOF |
| DNS TTL too high | Failover exceeds RTO because clients cache old IP | Set TTL ≤ 60 s for failover-eligible records |
| No replication lag SLA | DR region has stale data; RPO violated without warning | Monitor replication lag; alert when lag exceeds RPO target |
| Failover never tested | Recovery procedure exists on paper but fails in practice | Include failover drill in implementation plan as required task before GA |
| Batch buffer overflow on failover | In-flight batch items lost during region switch | Document buffer drain strategy; prefer idempotent replay |

---

## Required HA section in the deliverable

Add after Section 6 — Failure Handling Design:

```
## High Availability and Disaster Recovery

### RPO and RTO targets
| Component / data type | RPO | RTO | Source |
|---|---|---|---|
| <component> | <target> | <target> | <spec section or open decision #> |

### HA pattern and rationale
<chosen pattern; reference pattern selection table in 02-multi-cloud-parity.md>

### Multi-region topology diagram
<Mermaid flowchart: primary region, DR region, replication paths, failover routing>

### Data residency mapping
<Table per constrained data type — or "no residency constraints stated in spec">

### Failover runbook pointer
<Reference to runbook location — not full content>
```

---

## Data residency documentation template

When the spec states residency constraints:

| Field | Content |
|---|---|
| Data type | e.g. "patient records", "regulatory documents" |
| Residency constraint | e.g. "US only (contractual)" |
| Services affected | Every service that stores or processes this data type |
| Region selection | Approved region(s) for each affected service |
| Cross-region transfer | Whether transfer is ever permitted and under what conditions |

**Rule:** Every service in the deliverable must have an explicit region assignment for constrained
data types. Do not leave region as "TBD" for any constrained data type.
