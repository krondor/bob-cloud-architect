# Architecture Standards and Patterns

## Pattern selection criteria

State the cloud-agnostic pattern before rendering cloud-specific implementations.
Use the table below to select the primary pattern; record the rationale as an ADR for any non-obvious choice.

| Pattern | Use when | Prefer instead when |
|---|---|---|
| **Event choreography** | Loose coupling; teams own separate services; eventual consistency acceptable | Compensating transactions required **and** the steps must roll back atomically — use orchestration-based saga instead; choreography-based sagas are also valid when each service can publish success/failure events |
| **Event orchestration (Saga)** | Cross-service transactions; rollback logic; explicit audit trail | Same-team services; shared DB transaction would suffice |
| **Transactional outbox** | Guaranteed event publication on DB write; no 2PC | DB cannot support outbox table or CDC |
| **CQRS** | Asymmetric read/write loads; multiple read representations | Simple CRUD; team lacks eventual-consistency experience |
| **Event sourcing** | Full audit trail required; temporal queries needed | Simple CRUD; GDPR right-to-erasure without crypto-shredding |
| **Strangler fig** | Incremental legacy migration; clear routing seams | Greenfield; no routing seam; short migration window |
| **Bulkhead** | Different criticality / SLA across processing paths | All paths have equal criticality; isolation adds cost without benefit |
| **Circuit breaker** | Slow/intermittent downstream service | Always-fast synchronous downstream; no fallback exists |

Start from the simplest design that meets the spec (single service, one managed database,
synchronous calls). Add a pattern from this table only when a stated requirement forces it.

## Justify every significant recommendation

For each pattern or service choice that materially shapes the design, record in the ADR (or the
Open Decisions section) four things:

1. **Forcing requirement** — the spec requirement or constraint that demands it.
2. **Simpler alternative considered** — and why it does not meet the requirement.
3. **Operational burden added** — what the team must run, monitor, or learn.
4. **Evidence that would change the decision** — a measurable trigger, not a preference.

## Service selection rules

| Rule | Detail |
|---|---|
| Managed over self-managed | Default to managed unless spec states a constraint the managed service cannot meet |
| Cloud-native over cloud-agnostic middleware | Use native queue/streaming/orchestration per cloud; only add Kafka/Temporal/Airflow if spec requires cross-cloud portability or team already operates it |

---

## ADR format

Record non-obvious design choices as ADRs in `docs/<spec-id>/adr-<MMM>.md` (`<MMM>` = ADR sequence within that spec) or in the deliverable's Open Decisions section.

```
# ADR-NNN: <short title>
Status: proposed | accepted | superseded
Date: YYYY-MM-DD

## Context
<What problem or constraint drives this decision?>

## Decision
<What was decided?>

## Consequences
<Positive outcomes; costs or risks>

## Alternatives considered
<Options evaluated; why rejected>
```

---

## C4 diagram levels

| Level | Scope | Mermaid type | When to produce |
|---|---|---|---|
| L1 — Context | System + external actors | `flowchart TD` | Every architecture; mandatory |
| L2 — Container | Deployable units (services, DBs, queues) | `flowchart TD` with subgraphs | Every architecture; mandatory |
| L3 — Component | Internals of a single container | `flowchart TD` | When a spec task explicitly calls for it |
| L4 — Code | Class/module | Not used | Never |

Default deliverable: L1 + L2. One C4 level per diagram — do not mix container and component detail.

## Diagram conventions

- `subgraph` for system boundaries: cloud region, enterprise network, external system
- Label every arrow with the data type or event name (not just a line)
- Failure paths: dashed arrows `-.->` 
- Cloud-specific nodes: `ServiceName["ServiceName\n(AWS: SQS / Azure: Service Bus / GCP: Pub/Sub)"]`
- Cloud-agnostic nodes: `ServiceName["ServiceName"]`
