# spec.md

**Spec ID:** 002-clinical-trial-telemetry-platform
**Mode:** cloud-architect
**Status:** draft
**Created:** 2025-01-27
**Author:** enterprise-architecture-team

---

## Business problem

A global biopharmaceutical enterprise operates Phase II–IV clinical trials across 500+ medical sites worldwide. Patients wear continuous biometric telemetry devices (monitoring heart rate, SpO2, blood pressure, ECG waveforms, and continuous glucose). In addition, clinical investigators submit unstructured Electronic Case Report Form (eCRF) adverse event notes.

Currently, site telemetry and adverse events are processed in fragmented, localized batch systems with 24-hour latency. This delay prevents real-time identification of acute adverse drug reactions (ADRs). The enterprise requires a unified, multi-cloud, event-driven telemetry and safety monitoring platform that:

1. Ingests high-frequency time-series telemetry streams (50,000 events/sec peak) with sub-second ingestion latency.
2. Performs real-time stream processing and safety anomaly detection, routing urgent safety alerts to site investigators within 2 seconds.
3. Enriches physiological anomalies with LLM-extracted clinical safety insights from clinician notes and protocol safety rules.
4. Persists raw and aggregated data into a 21 CFR Part 11 and HIPAA-compliant multi-cloud lakehouse (Apache Iceberg over Snowflake and Databricks) with automated reconciliation and immutable audit ledgers.

---

## Scope

**In scope:**
- Multi-cloud streaming & event architecture across AWS, Azure, and GCP with full parity.
- Edge ingestion & de-identification proxy (tokenizing Direct Patient Identifiers / PHI prior to cloud ingress).
- High-throughput streaming bus partitioned by `protocol_id` and `patient_id`.
- Real-time stream processing for threshold anomaly detection and micro-batch aggregation.
- LLM Clinical Insight Engine: Automated adverse event categorization and risk synthesis (Bedrock, Azure OpenAI, Vertex AI) using clinical protocol templates.
- Multi-engine Lakehouse persistence (Apache Iceberg REST Catalog, Snowflake Clinical Data Warehouse, Databricks Biostatistics ML Store).
- External integrations: Electronic Data Capture (EDC) systems, Argus Safety/Pharmacovigilance gateway, Snowflake, Databricks, Iceberg, and Cloud LLMs.
- Resilience: Partition-preserving retry, dead-letter queues with quarantine replay, and end-to-end telemetry reconciliation ledger.
- Security & Compliance: GxP / 21 CFR Part 11 / HIPAA compliant posture (per-component IAM/RBAC, KMS CMK, PHI vault, WORM immutable audit logs).
- Cost model across streaming shards, serverless compute, storage tiers, LLM tokens, and cross-region egress.
- Downstream handoff contracts: CloudEvents JSON Schema, status tracking / reconciliation ledger DDL, safety alert prompt specification, canonical repository tree.

**Out of scope:**
- Firmware / hardware code on wearable IoT edge devices.
- Concrete Terraform / IaC code implementations.
- Application microservice source code.
- End-user mobile application UI/UX.

---

## Target clouds

AWS, Azure, and GCP — all three with equal architectural depth. The enterprise deploys regional trial instances across different cloud providers based on regional regulatory data residency constraints (US FDA on AWS, EU EMA on Azure/GCP).

---

## Integration targets

| System | Direction | Connection | Auth model | Unknowns |
|---|---|---|---|---|
| **EDC Gateways (e.g. Medidata)** | Inbound (read/sync) | Webhook / REST API over TLS 1.3 | Mutual TLS (mTLS) + OAuth 2.0 Client Credentials | Webhook retry backoff parameters — open decision #1 |
| **Argus Safety / Pharmacovigilance** | Outbound (alert dispatch) | Secure REST API / HL7 FHIR over HTTPS | OAuth 2.0 with JWT signed via Secrets Manager | HL7 FHIR v4.0.1 schema version validation — open decision #2 |
| **Snowflake (Clinical DW)** | Outbound (write + query) | Snowpipe Streaming / Storage Integration | Key-pair auth via Secrets Manager | Iceberg external volume vs native managed table — open decision #3 |
| **Databricks (Biostatistics ML)** | Outbound (write + query) | Delta Sharing / REST API | Service principal via Secrets Manager | Unity Catalog metastore partition federation — open decision #4 |
| **Apache Iceberg Lakehouse** | Bidirectional | REST Catalog API (Polaris / Glue / Unity) + storage credential vending | STS / Azure SAS / GCP short-lived OAuth tokens | Catalog synchronization strategy — open decision #5 |
| **Cloud LLM Services** | Outbound (inference) | Cloud-native SDK (Bedrock Converse, Azure OpenAI, Vertex AI) | Cloud IAM / Managed Identity / Workload Identity | Maximum token ceiling per safety synthesis — open decision #6 |

---

## Constraints

- **Regulatory Compliance:** Strict adherence to FDA 21 CFR Part 11 (audit trails, electronic records), GxP validation standards, HIPAA, and EU GDPR.
- **Data Residency & Isolation:** Patient identifiable data must never cross continental boundaries (US data in US regions, EU data in EU regions).
- **Zero Raw PHI in AI Prompts:** Direct identifiers (Name, SSN, MRN, Hospital Patient ID) must be pseudonymized via a cryptographic hashing/vault proxy before entering streaming queues or LLM context.
- **Latency SLAs:**
  - Critical safety alert trigger: $\le 2$ seconds from telemetry ingestion to Argus webhook notification.
  - LLM contextual clinical summary: $\le 60$ seconds from adverse event trigger.
  - Lakehouse write availability: $\le 5$ minutes for raw telemetry (Bronze) and aggregated summaries (Silver).
- **Encryption & Key Management:** KMS Customer-Managed Keys (CMK) with automated 365-day rotation for all data at rest. TLS 1.3 enforced for all transport.
- **Audit Logging:** WORM (Write Once, Read Many) object storage retention for 25 years with immutable object lock.

---

## Acceptance criteria

The architecture deliverable is complete when all of the following are satisfied:

- [ ] Cloud-agnostic high-level architecture diagram detailing the streaming, processing, AI enrichment, and lakehouse layers.
- [ ] Cloud-specific architecture diagrams (AWS, Azure, GCP) with 1:1 service mappings for all streaming and compute components.
- [ ] Component selection matrix covering: stream ingestion, stream analytics, event bus, serverless compute, LLM service, time-series buffer, Iceberg catalog, secrets, KMS, monitoring, DLQ — with a **Cost Model** column per row.
- [ ] Real-time stream processing & safety threshold evaluation pattern documented for all three clouds.
- [ ] PHI de-identification and cryptographic pseudonymization proxy pattern documented.
- [ ] Apache Iceberg multi-engine data mesh pattern documented (simultaneous read/write from Snowflake and Databricks).
- [ ] All six external integration targets documented with connection mechanism, auth model, data flow, failure behavior, and observability.
- [ ] Telemetry status tracking & safety reconciliation ledger DDL documented.
- [ ] Reconciliation engine design documented (handling out-of-order biometric events and gap detection).
- [ ] Security architecture: Per-component IAM/RBAC matrix, KMS CMK key hierarchy, secrets rotation schedule, and 21 CFR Part 11 audit trail specification.
- [ ] Resilience architecture: Partition-aware retry policies, dead-letter quarantine with automated replay workflows.
- [ ] CloudEvents schema for streaming telemetry events (`clinical.telemetry.v1`) and adverse safety alerts (`clinical.safety_alert.v1`).
- [ ] AI prompt specification for clinical adverse event summarization (`prompts/clinical_safety_summary_prompt.yaml`).
- [ ] Canonical project folder structure tailored for downstream streaming, AI engine, and IaC implementation.
- [ ] Phased implementation roadmap with explicit milestone hand-off criteria.

---

## Open decisions

| # | Decision | Owner | Target date |
|---|---|---|---|
| 1 | EDC webhook retry strategy and payload signing standard | Clinical Data Operations | 2025-02-15 |
| 2 | Pharmacovigilance alert payload schema (HL7 FHIR v4 vs custom JSON) | Safety & PV Lead | 2025-02-18 |
| 3 | Snowflake storage integration pattern (Apache Iceberg table direct read vs Snowpipe Bronze copy) | Data Architecture | 2025-02-20 |
| 4 | Unity Catalog multi-cloud metastore peering approach | Lakehouse Engineering | 2025-02-22 |
| 5 | Iceberg REST catalog engine selection across cloud variants | Cloud Platform Architect | 2025-02-25 |
| 6 | LLM token budget and context chunking strategy for long clinician notes | AI/ML Safety Lead | 2025-02-28 |
