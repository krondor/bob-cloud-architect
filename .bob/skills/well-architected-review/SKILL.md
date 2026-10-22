---
name: well-architected-review
version: 1.1.1
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
2. Work through each pillar — answer each review question against the deliverable.
3. For each gap (a question with no evidence), note it in the deliverable's Open Decisions
   section with the pillar name, the question, and the suggested remediation.
4. A deliverable passes a pillar when all questions have documented evidence or an accepted
   risk acknowledgement. A deliverable passes the review when all five pillars pass.

---

## Pillar 1 — Operational Excellence

**Goal:** The system can be operated, observed, and improved over time.

### Review questions

1. Are there structured logs from every component with a consistent format (JSON, structured fields)?
2. Is there a defined alerting strategy — conditions, thresholds, and recipients?
3. **[POC]** Are DLQ alert thresholds explicitly defined (depth limit, message age limit)?
4. **[POC]** Is dead-letter replay automation documented (trigger mechanism, replay queue, idempotency guarantee)?
5. **[POC]** Is a scheduled reconciliation worker specified (trigger interval, discrepancy alert path, run log schema)?
6. Is there a runbook pointer for each failure mode in the deliverable?
7. Is the deployment process defined (how a new version is released without downtime)?
8. Are all configuration values externalized (not baked into the artifact) and their source documented?

### Common gaps

- DLQ documented but no alert threshold or automated replay trigger
- Reconciliation worker mentioned but trigger interval and discrepancy SLA not defined
- Log strategy present but alert conditions not specified

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

1. Is there a least-privilege IAM role / managed identity per component (one role per service, no shared roles)?
2. **[POC]** Are CMK KMS keys uniquely specified per micro-component (separate key per service, not one shared key)?
3. Is encryption at rest documented for every data store (type of key, KMS service)?
4. Is encryption in transit enforced for every service-to-service connection (TLS version)?
5. Are secrets in a secrets manager — not in environment variables, code, or config files?
6. Is there an audit log for every security-relevant event (auth, data access, config change)?
7. **[POC]** Is PII sanitization explicitly placed before LLM API invocation in the architecture?
8. Is the PII handling policy documented (scan location, masking strategy, log exclusion)?
9. Is the network boundary defined (VPC/VNet, subnets, private endpoints for managed services)?
10. Is there a stated compliance requirement and is the architecture consistent with it?

### Common gaps

- Single KMS key used across all services — per-component CMK not specified
- PII scan step present in diagram but not confirmed to occur before LLM call
- Audit logging covers application logs but not cloud API call logs (CloudTrail / Activity Log / Cloud Audit Logs)
- Secrets manager referenced but rotation interval and mechanism not specified

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
2. **[POC]** Is jitter explicitly specified for all retry strategies (prevents thundering-herd on recovery)?
3. **[POC]** Are batch buffer overflow limits documented (maximum batch size, overflow split strategy)?
4. **[POC]** Are circuit breakers documented for all slow/expensive external calls (Snowflake, Databricks, Cloud LLM)?
5. Is there a DLQ or equivalent for every async processing path?
6. Is there a defined recovery procedure for DLQ messages (reprocessing trigger, alerting)?
7. Are RPO and RTO targets stated in the spec or plan? Are they achievable with the chosen design?
8. Is there a health check or readiness probe defined for every compute component?
9. Is there a data backup and restore procedure for every stateful component?
10. Are single points of failure identified and either accepted (with rationale) or eliminated?

### Common gaps

- Retry strategy documented but no jitter — thundering-herd risk on recovery
- Batch buffer overflow behavior not specified — data loss risk on buffer saturation
- Circuit breakers not present on Snowflake/Databricks/LLM calls — slow downstream blocks pipeline
- DLQ present but no alert on depth and no reprocessing procedure

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
| GCP | [Performance optimization — Google Cloud Architecture Framework](https://cloud.google.com/architecture/framework/performance-optimization) |

---

## Pillar 5 — Cost Optimization

**Goal:** The system delivers business value at the lowest appropriate cost.

### Review questions

1. **[POC]** Is a Cost Model column present in the component selection matrix (mandatory — not optional)?
2. **[POC]** Is a token cost range present for every LLM integration (input/output tokens, monthly range, assumptions stated)?
3. **[POC]** Is storage tiering documented for Iceberg Parquet files and the reconciliation ledger (with lifecycle policy)?
4. Are resource tagging and cost allocation controls documented?
5. Is there a budget alerting mechanism specified?
6. Are spot/preemptible instances considered for batch or fault-tolerant workloads?
7. Are data transfer costs identified for cross-region or cross-cloud flows?
8. Are any services provisioned at fixed capacity that could be replaced with consumption-based alternatives?

### Common gaps

- No Cost Model column in component selection matrix
- LLM token cost not estimated — largest variable cost in document processing platforms
- Iceberg / Parquet storage tier not specified — defaults to hot, which is expensive for retained data
- Cross-cloud data transfer (Snowflake ↔ Databricks via object store) not flagged as egress-dominant

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
- ✅ **Pass** — all questions have documented evidence or accepted risk acknowledgements
- ⚠️ **Gap** — 1–2 questions unanswered; deliverable can proceed with open decisions added
- ❌ **Fail** — 3+ questions unanswered, or any **[POC]** question or P0 question (IAM, encryption, retry) is unanswered

A ❌ Fail on Security or Reliability blocks deliverable sign-off.
A ⚠️ Gap on any pillar requires an open decision entry before handoff to engineering.
