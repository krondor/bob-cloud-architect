---
name: data-architecture-patterns
version: 1.0.0
description: >
  Generic data-platform architecture guidance for AWS, Azure, and GCP: store selection
  (OLTP, warehouse, lakehouse, streaming), medallion layering, open table formats and catalogs,
  streaming ingestion selection, data mesh and data products, governance, and data residency.
  Includes decision trees, anti-patterns, and cloud service mappings.
when_to_use: >
  Load when a spec involves analytical data, a data lake or lakehouse, streaming analytics,
  cross-domain data sharing, a data catalog or governance requirement, or when the
  cloud-architecture-patterns decision tree ends at "no pattern applies" for a data problem.
  For batch LLM summarisation of documents, also load document-processing-profile.
---

# Data Architecture Patterns

Design guidance only. No DDL, pipeline code, or IaC. Include only the clouds declared in the spec.

## Skill navigation

| Section | Use when |
|---|---|
| [Store selection](#store-selection) | Choosing OLTP vs warehouse vs lakehouse vs stream |
| [Layering](#layering-medallion) | Structuring raw → curated → serving data |
| [Open table formats and catalogs](#open-table-formats-and-catalogs) | Multi-engine access, Iceberg/Delta, catalog federation |
| [Streaming ingestion](#streaming-ingestion-selection) | Choosing a stream or message platform for analytics |
| [Data mesh and data products](#data-mesh-and-data-products) | Multiple domains owning and sharing data |
| [Governance and access](#governance-and-access) | Catalog, lineage, fine-grained access, credential vending |
| [Residency and sovereignty](#residency-and-sovereignty) | Region, replication, and cross-border constraints |
| [Anti-patterns](#anti-patterns) | Review checks |
| [Cloud service reference](#cloud-service-reference) | Component selection matrix |
| [Grounding sources](#grounding-sources) | Where each claim was verified |

---

## Store selection

```
What is the primary access pattern?
├── Low-latency transactional reads/writes, row-level updates, constraints
│     → OLTP database (see cloud-architecture-patterns: CQRS/outbox for read-model split).
│       Do not run analytical scans against it; replicate or stream changes out.
├── SQL analytics, BI, governed structured data, concurrent dashboard users
│     → Cloud data warehouse (Redshift / Synapse or Fabric Warehouse / BigQuery)
├── Mixed structured + semi/unstructured data, Spark/ML workloads, or multiple engines
│   must read the same tables
│     → Lakehouse: object storage + open table format + catalog
└── Continuous event flow with sub-minute freshness requirement
      → Streaming platform feeding one of the above (see Streaming ingestion selection)
```

Heuristics:
- Choose a lakehouse when more than one engine must read the same tables, or when data is
  largely files. Choose a warehouse when the workload is predominantly governed SQL/BI and
  the team does not need Spark or open-format access.
- On Fabric, the Lakehouse vs Warehouse choice follows the team skill set (Spark vs T-SQL),
  the need for multi-table transactions (Warehouse), and the share of unstructured data
  (Lakehouse). Both store Delta Parquet in OneLake.
- A single store rarely fits all. State which store is the system of record for each dataset.

## Layering (medallion)

| Layer | Content | Rules |
|---|---|---|
| Raw / bronze | Source data as received, immutable | Append-only; retain lineage keys; no business logic |
| Curated / silver | Cleaned, conformed, deduplicated | Schema enforced; data-quality checks gate promotion |
| Serving / gold | Business-ready aggregates and data products | Owned by a named team; versioned contract; SLA stated |

State for each layer: owner, retention, format, access group, and quality gate. Do not let
consumers read raw directly except for named, audited exceptions.

## Open table formats and catalogs

Use an open table format (Apache Iceberg or Delta Lake) when data must be shared between
engines or avoid lock-in to one compute vendor.

Decision points to record in the design:
1. **Format of record** (Iceberg or Delta), and which engines write vs only read.
2. **Catalog of record** — one catalog owns commits for a table. Other catalogs federate or
   mirror; they do not co-own writes.
3. **Metadata virtualization limits** — a virtualized view (e.g. Delta exposed as Iceberg)
   gives read compatibility only and does not support catalog commits from Iceberg writers.
4. **Table maintenance owner** — compaction, snapshot expiry, and orphan-file cleanup are
   explicit tasks assigned to an engine or managed service.

| Cloud | Catalog and interoperability facts (verified; see Grounding sources) |
|---|---|
| AWS | Glue Data Catalog exposes an Iceberg REST endpoint; Lake Formation provides credential vending (scoped-down temporary credentials) for engines accessing S3 data. SageMaker lakehouse unifies S3 data lakes and Redshift under the Glue Data Catalog. |
| Azure | OneLake stores Delta Parquet; Delta tables can be virtualized as Iceberg (read). OneLake table APIs expose an Iceberg REST Catalog endpoint (reads, writes for native Iceberg tables, credential vending); one namespace level maps to schemas. Native-Iceberg writes commit via the REST endpoint. |
| GCP | Lakehouse runtime catalog implements the Iceberg REST Catalog API; Iceberg V2 GA, V3 Preview, V1 unsupported. BigQuery read/write to these tables is Preview. Catalog federation covers AWS Glue, Databricks Unity Catalog, and Snowflake Horizon. BigLake metastore (classic) is legacy. |

Re-check version support and GA/Preview status before committing a design; these change often.

## Streaming ingestion selection

```
Do consumers need Kafka protocol / ecosystem compatibility or portability?
├── Yes → Managed Kafka: Amazon MSK | Confluent on Azure | Google Managed Service for Apache Kafka
│         (Event Hubs offers a Kafka-compatible endpoint, not a Kafka cluster)
└── No  → Is the goal landing streaming data in storage/warehouse with minimal code?
          ├── Yes → Firehose (AWS) | Event Hubs Capture (Avro to Storage/ADLS) or Fabric Eventstream (Azure) |
          │         Pub/Sub → BigQuery or Cloud Storage subscription (GCP)
          └── No  → Need stateful stream processing (windows, joins, CEP)?
                    ├── Yes → Managed Flink (AWS) | Fabric Eventstream/Stream Analytics (Azure) |
                    │         Dataflow (GCP)
                    └── No  → Kinesis Data Streams (AWS) | Event Hubs (Azure) | Pub/Sub (GCP)
```

Record: ordering requirement and key, delivery semantics (at-least-once is the common default;
design consumers to be idempotent), retention window, replay requirement, dead-letter path,
and throughput capacity mode (provisioned vs on-demand).

Selection facts:
- GCP: Pub/Sub is serverless with dead-letter topics and 31-day retention, and is not
  Kafka-compatible. Managed Service for Apache Kafka fits portability, strict ordering at high
  throughput, and long retention.
- AWS: Kinesis Data Streams (capacity: provisioned or on-demand), Amazon Data Firehose for
  managed delivery to stores, Managed Service for Apache Flink for stream processing, Amazon
  MSK when open-source Kafka compatibility is required.
- Azure: Fabric Eventstream offers a Kafka endpoint, at-least-once delivery, and up to
  90 days retention; Event Hubs has a Kafka-compatible endpoint; Event Grid is for discrete
  event routing, not high-volume streams.

## Data mesh and data products

Adopt a mesh only when several autonomous domains each have the people to own their data.
For a single team, a central lakehouse with clear layering is simpler.

Required elements of a mesh design:
- **Domain ownership** — named owner per data product.
- **Data product contract** — schema, semantics, freshness SLA, quality checks, access policy,
  version and deprecation policy.
- **Central governance plane** — catalog, policy, lineage, audit; domains publish, they do not
  each invent governance.
- **Self-service platform** — shared ingestion, storage, and catalog templates.

| Cloud | Mesh building blocks |
|---|---|
| AWS | Producer and consumer accounts under a central governance account; Glue Data Catalog + Lake Formation cross-account sharing (named-resource or LF-tag-based); Amazon SageMaker Catalog (built on DataZone) for discovery, data products, and subscription workflows |
| Azure | OneLake domains and workspaces; Microsoft Purview Unified Catalog governance domains and data products |
| GCP | Knowledge Catalog (formerly Dataplex) for governance, lineage, and data products (data products were Preview as of the Nov 2025 release notes); Lakehouse runtime catalog federation across projects |

## Governance and access

Minimum design content: catalog of record, classification scheme, lineage capture, who
approves access, how access is revoked, and where audit logs land.

- Prefer **credential vending / policy-enforced access** over long-lived storage keys for
  engine access to lakehouse tables.
- Use tag- or classification-based policies (Lake Formation LF-tags, Purview classifications,
  Knowledge Catalog aspects/policy tags) so access scales with data, not with resource names.
- Apply column and row-level controls at the catalog or warehouse layer, not in each consumer.
- Cross-account or cross-tenant sharing: share metadata and grants; avoid copying data unless
  residency or performance requires it, and record the cost of the copy.
- Sensitive data: classify before it reaches shared layers; mask or tokenise at ingestion for
  the layers consumers can read.

## Residency and sovereignty

Per dataset, state: region of storage, replication targets, backup region, where compute runs,
and where logs and catalog metadata reside (metadata can leak residency-sensitive values).
Cross-region catalog federation and cross-cloud access can move data or query results across
borders; record each path.

## Anti-patterns

| Anti-pattern | Why it fails | Instead |
|---|---|---|
| Analytical scans on the OLTP primary | Contention, unpredictable latency | Replicate or stream to an analytical store |
| Two catalogs both committing to one table | Lost updates, divergent metadata | One catalog of record; federate read access |
| Raw layer readable by all consumers | Uncontrolled sensitive data exposure | Curated layer as the default consumer surface |
| Mesh with no central governance | Inconsistent policy and no lineage | Central governance plane, federated ownership |
| Streaming without replay or DLQ design | Poison messages stall consumers; no recovery | Define retention, replay, and dead-letter path |
| Copy-everywhere sharing | Cost, drift, residency violations | Share by reference with grants first |
| No table maintenance owner | Small-file growth, slow queries, cost creep | Assign compaction/expiry to an engine or managed service |
| Choosing a format by engine fashion | Lock-in or rewrite | Choose format by required readers/writers matrix |

## Cloud service reference

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Object storage | S3 | ADLS Gen2 / OneLake | Cloud Storage |
| Warehouse | Redshift | Fabric Warehouse / Synapse | BigQuery |
| Lakehouse compute | EMR / Glue / Athena / Databricks | Fabric Lakehouse (Spark) / Databricks | Managed Service for Apache Spark / BigQuery / Databricks |
| Catalog | Glue Data Catalog (Iceberg REST) | OneLake catalog / Purview | Lakehouse runtime catalog |
| Governance | Lake Formation | Purview Unified Catalog | Knowledge Catalog |
| Streaming (platform) | Kinesis Data Streams / MSK | Event Hubs / Fabric Eventstream | Pub/Sub / Managed Kafka |
| Streaming (processing) | Managed Service for Apache Flink | Stream Analytics / Fabric Eventstream | Dataflow |
| Managed delivery to stores | Amazon Data Firehose | Event Hubs Capture (Avro; Parquet only via Stream Analytics) | Pub/Sub export subscriptions (BigQuery, Cloud Storage, Bigtable preview) |
| CDC / replication | DMS, zero-ETL integrations | Fabric Mirroring (Delta in OneLake), Eventstream CDC connectors | Datastream |
| Cross-engine table format | Iceberg (Glue REST) | Delta native; Iceberg virtualized or native | Iceberg (Lakehouse REST catalog) |

Service names change; verify against the Grounding sources before finalising a selection matrix.

## Grounding sources

Verified 2026 via vendor documentation MCP servers; re-verify when more than a few months old.

| Claim area | Source |
|---|---|
| Glue Iceberg REST, Lake Formation credential vending, SageMaker lakehouse | docs.aws.amazon.com (SageMaker lakehouse architecture, Lake Formation) |
| AWS streaming services | docs.aws.amazon.com/whitepapers/latest/build-modern-data-streaming-analytics-architectures (historical-reference whitepaper; confirm current service pages) |
| AWS data mesh with Lake Formation | docs.aws.amazon.com/prescriptive-guidance/latest/strategy-data-mesh |
| OneLake Iceberg REST API and limitations | learn.microsoft.com/fabric/onelake/table-apis/iceberg-table-apis-overview |
| Fabric Lakehouse vs Warehouse, Eventstream, Mirroring, Event Hubs Capture | learn.microsoft.com/fabric, learn.microsoft.com/azure/event-hubs |
| Purview governance domains and data products | learn.microsoft.com/purview |
| Knowledge Catalog rename and data products status | docs.cloud.google.com/knowledge-catalog/docs/release-notes |
| Pub/Sub subscription types | docs.cloud.google.com/pubsub/docs/subscriber |
| SageMaker Catalog / DataZone | docs.aws.amazon.com/datazone, docs.aws.amazon.com/sagemaker-unified-studio |
| Lakehouse runtime catalog, Iceberg versions, federation | docs.cloud.google.com/lakehouse/docs/about-lakehouse-catalogs |
| Pub/Sub vs Managed Kafka | docs.cloud.google.com/pubsub |
