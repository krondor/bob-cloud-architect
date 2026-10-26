# High Availability and Disaster Recovery

Every architecture must address HA/DR unless the spec explicitly excludes it with a rationale.

## Required HA section in the deliverable

This is Section 7 of the package (see `06-deliverable-format.md`). Use this structure:

```
## High Availability and Disaster Recovery

### RPO and RTO targets
| Component / data type | RPO | RTO | Source |
|---|---|---|---|
| <component> | <target> | <target> | <spec section or open decision #> |

### HA pattern and rationale
<chosen pattern; Active-active | Active-passive | Pilot-light | Backup and restore>

### Multi-region topology diagram
<Mermaid flowchart — when multi-region is in scope>

### Data residency mapping
<Table per constrained data type — or "no residency constraints stated in spec">

### Failover runbook pointer
<Reference to runbook location — not full content>
```

**Rule:** Never choose an HA pattern without RPO/RTO targets. If the spec omits them, add as
open decisions before selecting a pattern.

For HA pattern selection criteria (RPO/RTO/cost tradeoffs), failover level guidance (DNS,
load-balancer, application), common HA gaps, and data residency templates, load the
`cloud-architecture-patterns` skill.
