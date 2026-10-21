<!-- load when: designing component selection, producing architecture diagrams, or any task involving pattern selection or service trade-offs -->

# Architecture Standards and Patterns

## Cloud-agnostic pattern catalog

State the cloud-agnostic pattern before rendering cloud-specific implementations. This makes the
architecture portable across cloud teams and reviewable without cloud knowledge.

### Event-driven patterns

| Pattern | Intent | Use when | Do NOT use when |
|---|---|---|---|
| **Event choreography** | Services react to events independently; no central coordinator | Loose coupling is more important than visibility; teams own separate services | You need guaranteed ordering, compensating transactions, or a clear audit trail of flow |
| **Event orchestration (saga)** | A coordinator directs each step; compensating transactions on failure | You need explicit control flow, rollback logic, or cross-service transactions | Services are owned by the same team and the coordination overhead outweighs the benefit |
| **Transactional outbox** | Write to a local outbox table in the same DB transaction as the business write; relay publishes the event | You need at-least-once delivery without two-phase commit | Your database cannot support change-data-capture or outbox polling |
| **CQRS** | Separate read and write models | Read and write loads are asymmetric; read models need denormalization | The domain is simple and separate models add complexity without benefit |
| **Event sourcing** | Store state as an immutable sequence of events; derive current state by replaying | Full audit trail required; temporal queries needed | Simple CRUD domains; team lacks event sourcing operational experience |

### Structural patterns

| Pattern | Intent | Use when | Do NOT use when |
|---|---|---|---|
| **Strangler fig** | Incrementally replace a legacy system by routing traffic through a facade | Migrating a large monolith to services without a big-bang rewrite | Greenfield systems; the legacy system has no clear seams to route at |
| **Sidecar** | Deploy a helper process alongside each service instance for cross-cutting concerns | Logging, service mesh proxying, secret rotation, TLS termination | The concern is domain-specific to one service; a shared library would suffice |
| **Bulkhead** | Isolate failures by partitioning resources (thread pools, connection pools, queues) | Preventing cascading failures across service integrations | All downstream services have equal criticality and isolation adds cost without benefit |
| **Circuit breaker** | Stop calling a failing downstream; return a fallback; re-probe after a timeout | Protecting against slow or intermittently failing dependencies | The downstream is always fast and synchronous failures are acceptable |

### Data patterns

| Pattern | Intent | Use when | Do NOT use when |
|---|---|---|---|
| **Data mesh** | Domain teams own and publish their data as products; federated governance | Organization is large; domains are distinct; central data team is a bottleneck | Small teams; domains share data heavily; governance maturity is low |
| **Lambda architecture** | Separate batch (accurate, slow) and speed (approximate, fast) layers | Low-latency queries on high-volume data with a need for reprocessing | Unified streaming frameworks (Flink, Spark Structured Streaming) cover the use case |
| **Kappa architecture** | Single streaming layer replaces both batch and speed layers | You can reprocess from an immutable event log; team has streaming expertise | Historical data cannot be replayed as a stream |

---

## Service selection standards

### Managed vs. self-managed

Prefer managed services unless the spec states an operational requirement that the managed service
cannot satisfy (custom runtime, pricing model, compliance constraint, portability requirement).
Document the rationale when choosing self-managed.

### Cloud-native vs. cloud-agnostic middleware

When a capability (messaging, streaming, orchestration) exists natively on all three target clouds
with comparable maturity and cost, recommend the native service per cloud. Only recommend a
cloud-agnostic middleware layer (e.g. Kafka, Temporal, Airflow) when:
- The spec requires portability across clouds as an operational requirement, OR
- The team already operates that middleware and the operational cost of adding a managed service
  exceeds the benefit

Document the rationale either way in the component selection matrix.

---

## Architecture Decision Record (ADR) format

When a design choice has non-obvious tradeoffs, record it as an ADR in the deliverable's
Open Decisions section or as a standalone file in `docs/<spec-id>-adr-NNN.md`.

```
# ADR-NNN: <short title>

**Status:** proposed | accepted | superseded
**Date:** YYYY-MM-DD

## Context
<What is the problem or constraint driving this decision?>

## Decision
<What was decided?>

## Consequences
<What are the positive outcomes? What is the cost or risk?>

## Alternatives considered
<What other options were evaluated and why were they rejected?>
```

---

## C4 model levels

Use C4 levels to set diagram scope. Each level has a corresponding Mermaid diagram type.

| Level | Scope | Mermaid type | When to produce |
|---|---|---|---|
| L1 — Context | System in its environment; external actors and systems | `flowchart TD` | Every architecture; mandatory |
| L2 — Container | Major deployable units (services, databases, queues) inside the system | `flowchart TD` with subgraphs per boundary | Every architecture; mandatory |
| L3 — Component | Internal components of a single container | `flowchart TD` | When a container is complex enough to warrant it |
| L4 — Code | Class/module level | Not used in this mode | Never — this is implementation detail |

Default deliverable: L1 + L2. Add L3 only when a spec task explicitly calls for it.

---

## Diagram conventions (supplement to 06-deliverable-format.md)

- Use `subgraph` to draw system boundaries: cloud region, enterprise network, external system.
- Label every arrow with the data type or event name being passed (not just a line).
- Failure paths use dashed arrows: `-.->`.
- Node naming: `ServiceName["ServiceName\n(AWS: SQS / Azure: Service Bus / GCP: Pub/Sub)"]`
  for cloud-specific nodes; plain `ServiceName["ServiceName"]` for cloud-agnostic nodes.
- Keep diagrams at one C4 level per diagram — do not mix container and component detail.
