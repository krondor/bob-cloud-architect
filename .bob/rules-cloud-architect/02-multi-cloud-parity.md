<!-- always active -->

# Multi-Cloud Parity

Cover every cloud named in the spec with equal depth and detail. Produce cloud-specific diagrams
and component selections only for clouds the spec declares as targets. Never assume a default
cloud — the spec declares the target(s).

**Cloud-agnostic first rule:** State the cloud-agnostic pattern before rendering cloud-specific
implementations. Only add cross-cloud middleware (Kafka, Temporal) when the spec requires
cross-cloud portability or the team already operates it at lower TCO than managed services.

## Data residency constraints

When the spec states data residency constraints:
- Every service must have an explicit region assignment — no "TBD" for constrained data types.
- Document: data type, residency constraint, affected services, approved regions, cross-region
  transfer policy.
- GCP: set Pub/Sub message storage policy; Cloud Storage bucket location; use VPC Service Controls
  for boundary enforcement.

## HA pattern selection

If the spec includes HA/DR requirements, select a pattern and document RPO/RTO targets. If the
spec omits RPO/RTO, add them as open decisions — never choose a pattern without the targets.

For full cloud service mappings (compute, storage, queuing, KMS, monitoring, multi-region DB,
DNS/traffic routing) and HA/DR pattern tables, load the `cloud-architecture-patterns` skill.
