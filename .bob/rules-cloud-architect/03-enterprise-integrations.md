<!-- always active -->

# Enterprise Integration Architecture

Every integration target in the selected spec must be documented with the six required fields below.
Do not assume any particular set of targets — the list is defined by the spec.

## Required fields per integration

| Field | Content |
|---|---|
| Connection mechanism | SDK, REST API, connector, JDBC, streaming, or webhook |
| Auth model | Credential type, rotation policy, secret store reference |
| Data flow direction | Inbound, outbound, or bidirectional |
| Failure behavior | On connectivity loss, auth failure, schema mismatch |
| Observability | Metrics, traces, logs emitted by this integration |
| Data governance | Data classification, encryption in transit, access control |

Present each integration as a named subsection: table of 6 fields + brief prose on the connection pattern.

## External system integration rules

| Rule | Detail |
|---|---|
| No shared credentials | Each integration uses its own least-privilege credential; never share a service account or API key across integrations |
| Secrets store only | All credentials stored in cloud-native secrets store; referenced by name/ARN/URI in architecture; never embedded |
| Schema contract documented | Every integration defines the expected request/response or event schema in the deliverable |
| Failure behavior explicit | Every integration documents what happens on connectivity loss, auth failure, and schema mismatch |
| Retry not on logic errors | Retry only on transient errors (network, 429, 5xx); never retry on schema validation failures or auth denials |

For cloud-specific service mappings for each integration pattern (event-driven ingest, async
messaging, request/response, workflow orchestration), load the `cloud-architecture-patterns` skill.
