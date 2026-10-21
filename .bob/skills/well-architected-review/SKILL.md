---
name: well-architected-review
version: 1.0.0
description: >
  Structured five-pillar architecture review mapped to AWS Well-Architected Framework,
  Azure Well-Architected Framework, and Google Cloud's architecture pillars. Use to
  evaluate a spec or completed deliverable before calling a task done.
when_to_use: >
  Load when reviewing a completed architecture deliverable, when a spec task explicitly
  calls for a well-architected review, or when the agent needs to identify gaps before
  handing off to engineering.
---

# Well-Architected Review

## How to use this skill

1. Read the spec and the current deliverable.
2. Work through each pillar section below — answer each review question against the deliverable.
3. For each gap (a question with no evidence in the deliverable), note it in the deliverable's
   Open Decisions section with the pillar name, the question, and the suggested remediation.
4. A deliverable passes a pillar when all questions have documented evidence or an accepted
   risk acknowledgement. A deliverable passes the review when all five pillars pass.

---

## Pillar 1 — Operational Excellence

**Goal:** The system can be operated, observed, and improved over time.

### Review questions

1. Are there structured logs from every component, with a consistent format (JSON, structured fields)?
2. Is there a defined alerting strategy — what conditions trigger alerts, and who receives them?
3. Is there a runbook pointer or recovery procedure reference for each failure mode in the deliverable?
4. Is the deployment process defined (how is a new version released without downtime)?
5. Is there a defined on-call or incident response path documented in the spec or plan?
6. Are all configuration values externalized (not baked into the artifact) and their source documented?

### Common gaps

- Log strategy present but no alert thresholds defined
- Failure handling section lists DLQ but no alert on DLQ depth
- Deployment strategy not mentioned (implies blue/green or rolling is assumed but not documented)

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Operational Excellence Pillar](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/welcome.html) |
| Azure | [Operational Excellence — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/) |
| GCP | [Operational excellence — Google Cloud Architecture Framework](https://cloud.google.com/architecture/framework/operational-excellence) |

---

## Pillar 2 — Security

**Goal:** The system protects data, systems, and assets appropriately.

### Review questions

1. Is there a least-privilege IAM role or identity per component (one role per service)?
2. Is encryption at rest documented for every data store (type of key, KMS service)?
3. Is encryption in transit enforced for every service-to-service connection (TLS version)?
4. Are secrets stored in a secrets manager — not in environment variables, code, or config files?
5. Is there an audit log for every security-relevant event (auth, data access, config change)?
6. Is PII identified in the data model, and is the handling policy (scan, mask, exclude) documented?
7. Is the network boundary defined (VPC/VNet/VPC, subnets, private endpoints for managed services)?
8. Is there a stated compliance requirement (SOC 2, HIPAA, GxP) and is the architecture consistent with it?

### Common gaps

- Encryption at rest documented for object storage but not for queues or databases
- Secrets manager referenced but rotation interval not specified
- Audit logging section covers application logs but not cloud API call logs (CloudTrail / Activity Log / Cloud Audit Logs)
- Network topology not shown in diagrams — private vs. public endpoint not explicit

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html) |
| Azure | [Security — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/security/) |
| GCP | [Security, privacy, and compliance — Google Cloud Architecture Framework](https://cloud.google.com/architecture/framework/security) |

---

## Pillar 3 — Reliability

**Goal:** The system performs its intended function correctly and consistently, and recovers from failures.

### Review questions

1. Is there a retry strategy for every external call (max attempts, backoff algorithm, jitter)?
2. Is there a dead-letter queue or equivalent for every async processing path?
3. Is there a defined recovery procedure for DLQ messages (reprocessing trigger, alerting)?
4. Are circuit breakers or bulkheads documented for integrations with external systems?
5. Are RPO and RTO targets stated in the spec or plan? Are they achievable with the chosen design?
6. Is there a health check or readiness probe defined for every compute component?
7. Is there a data backup and restore procedure for every stateful component?
8. Are single points of failure identified and either accepted (with rationale) or eliminated?

### Common gaps

- Retry strategy documented but no jitter (leads to thundering-herd on recovery)
- DLQ present but no alert on DLQ depth and no reprocessing procedure
- RPO/RTO not stated — treated as "best effort" which is rarely acceptable in production
- Database backup documented but restore procedure and RTO not tested

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html) |
| Azure | [Reliability — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/reliability/) |
| GCP | [Reliability — Google Cloud Architecture Framework](https://cloud.google.com/architecture/framework/reliability) |

---

## Pillar 4 — Performance Efficiency

**Goal:** The system uses cloud resources efficiently and maintains performance as demand changes.

### Review questions

1. Is the compute model appropriate for the load pattern (serverless for bursty, container/VM for sustained)?
2. Is there a scaling strategy defined (horizontal, vertical, autoscaling trigger metric)?
3. Are latency requirements stated in the spec, and is the architecture consistent with them?
4. Are caching opportunities identified (object storage results, API responses, DB query results)?
5. Is the storage type matched to access pattern (hot/cool/archive, IOPS requirements)?
6. Are any N+1 query patterns or chatty API call patterns identified and addressed?
7. Is the chosen database type appropriate for the query pattern (relational, document, key-value, time-series)?

### Common gaps

- Autoscaling documented but trigger metric not specified (CPU? queue depth? custom metric?)
- Caching not mentioned for any component — common omission in architecture-level documents
- No latency budget defined end-to-end — hard to evaluate whether the design meets requirements

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Performance Efficiency Pillar](https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html) |
| Azure | [Performance Efficiency — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/performance-efficiency/) |
| GCP | [Performance optimization — Google Cloud Architecture Framework](https://cloud.google.com/architecture/framework/performance-optimization) |

---

## Pillar 5 — Cost Optimization

**Goal:** The system delivers business value at the lowest appropriate cost.

### Review questions

1. Is a cost characterization present in the component selection matrix (pay-per-request, reserved, etc.)?
2. Are resource tagging and cost allocation controls documented?
3. Is there a budget alerting mechanism specified?
4. Are spot/preemptible instances or serverless considered for batch or fault-tolerant workloads?
5. Are data transfer costs identified for cross-region or cross-cloud flows?
6. Is storage tiering documented with a lifecycle policy for data that ages out of hot access?
7. Are any services provisioned at a fixed capacity that could be right-sized or replaced with
   a consumption-based alternative?

### Common gaps

- No cost section in the deliverable despite component selection covering multiple managed services
- Data transfer cost not mentioned despite a multi-region or cross-cloud data flow
- Storage tier not specified — defaults to hot, which is expensive for compliance-retained data

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Cost Optimization Pillar](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html) |
| Azure | [Cost Optimization — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/cost-optimization/) |
| GCP | [Cost optimization — Google Cloud Architecture Framework](https://cloud.google.com/architecture/framework/cost-optimization) |

---

## Review output format

After completing the review, produce a summary table:

```
| Pillar | Status | Gap count | Top gap |
|---|---|---|---|
| Operational Excellence | ✅ Pass / ⚠️ Gap / ❌ Fail | N | <one-line description> |
| Security | ... | ... | ... |
| Reliability | ... | ... | ... |
| Performance Efficiency | ... | ... | ... |
| Cost Optimization | ... | ... | ... |
```

Status definitions:
- ✅ **Pass** — all review questions have documented evidence or accepted risk acknowledgements
- ⚠️ **Gap** — 1–2 questions unanswered; deliverable can proceed with open decisions added
- ❌ **Fail** — 3+ questions unanswered, or a P0 question (IAM, encryption, retry) is unanswered

A ❌ Fail on Security or Reliability blocks deliverable sign-off.
A ⚠️ Gap on any pillar requires an open decision entry before handoff to engineering.
