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

## Data transfer cost rule

Any architecture moving large data volumes across regions or to external systems must include a
data transfer cost note. Flag as open decision if volumes are unknown. Cross-cloud transfers are
internet egress on both sides — always flag as an open decision if volumes are unknown.

For detailed compute cost patterns, storage tier selection, cost governance controls per cloud,
and multi-region cost multipliers, load the `cloud-architecture-patterns` skill.
