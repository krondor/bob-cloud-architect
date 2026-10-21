<!-- load when: designing integration patterns between the system and any external data platform, API, or cross-cloud service -->

# Enterprise Integration Architecture

Every integration target in the active spec must be documented with the following information. The list of integration targets is defined by the spec — do not assume any particular set of targets.

## Required fields per integration

For every integration target listed in the spec, document:

1. **Connection mechanism** — SDK, REST API, connector, JDBC, or streaming
2. **Auth model** — credential type, rotation policy, secret store reference
3. **Data flow direction** — inbound, outbound, or bidirectional
4. **Failure behavior** — what happens on connectivity loss, auth failure, or schema mismatch
5. **Observability** — how the integration emits metrics, traces, and logs
6. **Data governance** — PII classification, encryption in transit, access control

## Integration architecture section format

Present each integration as a named subsection with a table covering the 6 fields above, followed by a brief prose description of the connection pattern.

## Cross-cloud lakehouse (CCL) adapter pattern

When a spec includes cross-cloud lakehouse connectivity (e.g. accessing data across cloud boundaries via open table formats such as Apache Iceberg, Delta Lake, or Hudi), the architecture must include a dedicated adapter layer. This adapter must:

- Implement retry with exponential backoff on transient connectivity failures
- Log every request and response payload hash for audit (never log raw payload content)
- Sanitize PII from logs before emission
- Be independently deployable as its own compute unit (separate function, container, or service)
- Document the catalog technology (e.g. AWS Glue, Nessie, Polaris, Unity Catalog) and access pattern (REST catalog API vs. direct cloud storage access)

## LLM service integration

When the spec includes LLM processing, document for each LLM service:
- The model identifier and context window size
- Whether the call is synchronous or asynchronous
- Token budget per invocation and per-document cost estimate
- Retry behavior: retried on network/service errors only — never on model-level errors (invalid prompt, content policy)
- Prompt templates are versioned artifacts stored in `prompts/` in the target project
