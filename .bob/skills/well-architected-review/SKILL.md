---
name: well-architected-review
version: 1.4.1
description: >
  Structured five-pillar architecture review (plus an optional Sustainability pillar) mapped
  to the AWS, Azure, and Google Cloud Well-Architected Frameworks. Use to evaluate a spec or
  completed deliverable before calling a task done.
when_to_use: >
  Load when reviewing a completed architecture deliverable, when a spec task explicitly
  calls for a well-architected review, or when the agent needs to identify gaps before
  handing off to engineering.
---

# Well-Architected Review

## How to use this skill

1. Read the spec and the current deliverable.
2. Work through each pillar — answer each review question against the deliverable.
3. For each gap (a question with no evidence), record an entry with the pillar name, the
   question, and the suggested remediation.
   - In a mode that can write files (cloud-architect): add the entries to the deliverable's
     Open Decisions section and to `docs/<spec-id>/review-findings.md`.
   - In a read-only mode (architecture-reviewer): do not write. Emit the entries in chat as one
     fenced block headed `review-findings (paste into docs/<spec-id>/review-findings.md)`, so
     the cloud-architect mode can persist it and update `checkpoint.md`.
4. A deliverable passes a pillar when all questions have documented evidence or an accepted
   risk acknowledgement. A deliverable passes the review when all five core pillars pass (and Pillar 6 if the spec
   requires it — see below).
5. Check `docs/<spec-id>/evidence-register.md`: every `verified` row needs a vendor documentation
   URL and date. A `verified` row citing a skill, memory, or no URL is a gap (Operational Excellence).
6. If the spec declares `profile: document-processing`, load the `document-processing-profile`
   skill and apply its additional review checks after completing this review.

---

## Pillar 1 — Operational Excellence

**Goal:** The system can be operated, observed, and improved over time.

### Review questions

1. Are there structured logs from every component with a consistent format (JSON, structured fields)?
2. Is there a defined alerting strategy — conditions, thresholds, and recipients?
3. Is there a runbook pointer for each failure mode in the deliverable?
4. Is the deployment process defined (how a new version is released without downtime)?
5. Are all configuration values externalized (not baked into the artifact) and their source documented?
6. Are dead-letter queues or equivalent error paths present for every async processing flow, with alert thresholds defined?

### Common gaps

- Alert conditions not specified despite a log strategy being present
- DLQ documented but no alert threshold or automated replay trigger
- Log strategy present but deployment process not defined

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Operational Excellence Pillar](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/welcome.html) |
| Azure | [Operational Excellence — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/) |
| GCP | [Operational excellence — Google Cloud Well-Architected Framework](https://docs.cloud.google.com/architecture/framework/operational-excellence) |

---

## Pillar 2 — Security

**Goal:** The system protects data, systems, and assets appropriately.

### Review questions

Questions marked **[P0]** are blocking: an unanswered P0 question makes its pillar ❌ Fail.

1. **[P0]** Is there a least-privilege IAM role / managed identity per component (one role per service, no shared roles)?
2. **[P0]** Is encryption at rest documented for every data store (type of key, KMS service)?
3. **[P0]** Is encryption in transit enforced for every service-to-service connection (TLS version)?
4. Are secrets in a secrets manager — not in environment variables, code, or config files?
5. Is there an audit log for every security-relevant event (auth, data access, config change)?
6. If the spec identifies data containing PII or sensitive information, is the handling policy documented (scan location, masking strategy, log exclusion)?
7. Is the network boundary defined (VPC/VNet, subnets, private endpoints for managed services)?
8. Is there a stated compliance requirement and is the architecture consistent with it?

### Common gaps

- Audit logging covers application logs but not cloud API call logs (CloudTrail / Activity Log / Cloud Audit Logs)
- Secrets manager referenced but rotation interval and mechanism not specified
- Network boundary undefined — no VPC/VNet or private endpoint specification

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html) |
| Azure | [Security — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/security/) |
| GCP | [Security, privacy, and compliance — Google Cloud Well-Architected Framework](https://docs.cloud.google.com/architecture/framework/security) |

---

## Pillar 3 — Reliability

**Goal:** The system performs its intended function correctly and consistently, and recovers from failures.

### Review questions

Questions marked **[P0]** are blocking: an unanswered P0 question makes its pillar ❌ Fail.

1. **[P0]** Is there a retry strategy for every external call (max attempts, backoff algorithm, jitter)?
2. Is there a dead-letter queue or equivalent for every async processing path?
3. Is there a defined recovery procedure for dead-letter messages (reprocessing trigger, alerting)?
4. Are RPO and RTO targets stated in the spec or plan? Are they achievable with the chosen design?
5. Is there a health check or readiness probe defined for every compute component?
6. Is there a data backup and restore procedure for every stateful component?
7. Are single points of failure identified and either accepted (with rationale) or eliminated?

### Common gaps

- Retry strategy documented but no jitter — thundering-herd risk on recovery
- DLQ present but no alert on depth and no reprocessing procedure
- RPO/RTO not stated — HA pattern chosen without a requirement

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html) |
| Azure | [Reliability — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/reliability/) |
| GCP | [Reliability — Google Cloud Well-Architected Framework](https://docs.cloud.google.com/architecture/framework/reliability) |

---

## Pillar 4 — Performance Efficiency

**Goal:** The system uses cloud resources efficiently and maintains performance as demand changes.

### Review questions

1. Is the compute model appropriate for the load pattern (serverless for bursty, container/VM for sustained)?
2. Is there a scaling strategy defined (horizontal, vertical, autoscaling trigger metric)?
3. Are latency requirements stated in the spec and is the architecture consistent with them?
4. Are caching opportunities identified (object storage results, API responses, DB query results)?
5. Is the storage type matched to access pattern (hot/cool/archive, IOPS requirements)?
6. Are any N+1 query or chatty API patterns identified and addressed?
7. Is the chosen database type appropriate for the query pattern (relational, document, key-value)?

### Common gaps

- Autoscaling documented but trigger metric not specified (CPU? queue depth? custom metric?)
- No latency budget defined end-to-end
- Caching not mentioned for any component

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Performance Efficiency Pillar](https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html) |
| Azure | [Performance Efficiency — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/performance-efficiency/) |
| GCP | [Performance optimization — Google Cloud Well-Architected Framework](https://docs.cloud.google.com/architecture/framework/performance-optimization) |

---

## Pillar 5 — Cost Optimization

**Goal:** The system delivers business value at the lowest appropriate cost.

### Review questions

1. Is a Cost Model column present in the component selection matrix (mandatory — not optional)?
2. Are resource tagging and cost allocation controls documented?
3. Is there a budget alerting mechanism specified?
4. Are spot/preemptible instances considered for batch or fault-tolerant workloads?
5. Are data transfer costs identified for cross-region or cross-cloud flows?
6. Are any services provisioned at fixed capacity that could be replaced with consumption-based alternatives?
7. Is storage tiering documented for any compliance-retained or large-volume data?

### Common gaps

- No Cost Model column in component selection matrix
- No budget alerting mechanism specified
- Cross-region data transfer not flagged as a cost driver

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Cost Optimization Pillar](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html) |
| Azure | [Cost Optimization — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/cost-optimization/) |
| GCP | [Cost optimization — Google Cloud Well-Architected Framework](https://docs.cloud.google.com/architecture/framework/cost-optimization) |

---

## Pillar 6 — Sustainability (optional)

AWS and Google Cloud publish Sustainability as a sixth pillar; Azure publishes it as a
separate Well-Architected overview. Review it only when the spec lists sustainability or
carbon reporting as a requirement or constraint. It does not change the five-pillar pass rule.

### Review questions

1. Are region choices justified against carbon intensity as well as latency, residency, and cost?
2. Are workloads sized and scheduled to avoid idle capacity (scale-to-zero, batch windows, rightsizing)?
3. Are data retention and storage-tier policies defined so data is not kept hot longer than needed?
4. Is the provider's carbon-reporting tool named as the measurement source?

### Cloud framework references

| Cloud | Framework section |
|---|---|
| AWS | [Sustainability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sustainability-pillar.html) |
| Azure | [Sustainability — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/sustainability/) |
| GCP | [Sustainability — Google Cloud Well-Architected Framework](https://docs.cloud.google.com/architecture/framework/sustainability) |

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
| Sustainability (optional) | ... | ... | ... |
```

Status definitions:
- ✅ **Pass** — all questions have documented evidence or accepted risk acknowledgements
- ⚠️ **Gap** — 1–2 questions unanswered; deliverable can proceed with open decisions added
- ❌ **Fail** — 3+ questions unanswered, or any question marked **[P0]** unanswered (IAM, encryption at rest and in transit, retry)

A ❌ Fail on Security or Reliability blocks deliverable sign-off.
A ⚠️ Gap on any pillar requires an open decision entry before handoff to engineering.

> **Document-processing profile:** if the spec declares `profile: document-processing`,
> load the `document-processing-profile` skill and append its additional review checks to
> this table before finalising the review.
